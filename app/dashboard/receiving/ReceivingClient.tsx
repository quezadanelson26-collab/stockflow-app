'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Html5Qrcode } from 'html5-qrcode';
import { formatNumber, formatCurrency } from '@/lib/format';
import { TOAST_DURATION } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────────────

interface SessionItem {
  key: string;
  barcode: string;
  product_name: string;
  variant_name: string;
  sku: string;
  variant_id: string;
  product_id: string;
  vendor: string;
  po_id: string | null;
  po_number: string | null;
  line_item_id: string | null;
  quantity: number;
  unit_cost: number;
  ordered_qty: number;
  already_received: number;
  added_during_receiving: boolean;
}

interface POChoice {
  po_id: string;
  po_number: string;
  line_item_id: string;
  ordered_qty: number;
  already_received: number;
  remaining: number;
  unit_cost: number;
}

interface VariantInfo {
  product_name: string;
  variant_name: string;
  barcode: string;
  sku: string;
  variant_id: string;
  product_id: string;
  vendor: string;
  unit_cost: number;
}

type Phase = 'idle' | 'scanning' | 'reviewing' | 'processing' | 'done';

// ─── Component ──────────────────────────────────────────────

export default function ReceivingClient() {
  const supabase = createClient();

  // Phase
  const [phase, setPhase] = useState<Phase>('idle');

  // Session data
  const [sessionItems, setSessionItems] = useState<Record<string, SessionItem>>(
    {}
  );
  const [scanCount, setScanCount] = useState(0);

  // UI
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  // Camera scanning
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  // PO picker modal
  const [poPickerData, setPoPickerData] = useState<{
    variant: VariantInfo;
    choices: POChoice[];
  } | null>(null);

  // Processing results
  const [processResults, setProcessResults] = useState<{
    posUpdated: number;
    itemsReceived: number;
    quickPOCreated: string | null;
  } | null>(null);

  // Scan feedback
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Session locking — prevents 2 people receiving the same PO
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [activeLocks, setActiveLocks] = useState<Set<string>>(new Set());
  const [lockConflict, setLockConflict] = useState<{
    po_number: string;
    locked_by: string;
    locked_since: string;
  } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Audio & Haptic Feedback ────────────────────────────

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playBeep = useCallback((type: 'success' | 'warning' | 'error') => {
    try {
      const ctx = getAudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.3;

      if (type === 'success') {
        // High cheerful beep
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
      } else if (type === 'warning') {
        // Medium double tone
        oscillator.frequency.value = 440;
        oscillator.type = 'triangle';
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
      } else {
        // Low error buzz
        oscillator.frequency.value = 220;
        oscillator.type = 'square';
        gain.gain.value = 0.15;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio not supported — silent fallback
    }
  }, [getAudioCtx]);

  const triggerFeedback = useCallback((type: 'success' | 'warning' | 'error') => {
    // Sound
    playBeep(type);

    // Screen flash
    const colors = {
      success: 'rgba(34, 197, 94, 0.35)',   // green
      warning: 'rgba(245, 158, 11, 0.35)',   // amber
      error: 'rgba(239, 68, 68, 0.35)',      // red
    };
    setFlashColor(colors[type]);
    setTimeout(() => setFlashColor(null), 500);

    // Haptic vibration (mobile)
    if (navigator.vibrate) {
      if (type === 'success') navigator.vibrate(100);
      else if (type === 'warning') navigator.vibrate([100, 50, 100]);
      else navigator.vibrate([200, 100, 200]);
    }
  }, [playBeep]);

  // ─── Session Locking ───────────────────────────────────

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
        setCurrentUserEmail(data.user.email || '');
      }
    });
  }, [supabase]);

  // Heartbeat: keep locks alive every 60s while scanning/reviewing
  useEffect(() => {
    if ((phase === 'scanning' || phase === 'reviewing') && currentUserId) {
      heartbeatRef.current = setInterval(async () => {
        await supabase
          .from('po_receiving_locks')
          .update({ last_heartbeat: new Date().toISOString() })
          .eq('user_id', currentUserId);
      }, 60_000);
    }
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [phase, currentUserId, supabase]);

  // Release all locks when leaving the page
  useEffect(() => {
    const cleanup = () => {
      if (currentUserId) {
        navigator.sendBeacon?.('/api/release-locks', JSON.stringify({ user_id: currentUserId }));
      }
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [currentUserId]);

  // Check if a PO is locked by another user, returns lock info or null
  const checkPOLock = useCallback(async (poId: string): Promise<{ locked_by_email: string; locked_at: string } | null> => {
    if (!currentUserId) return null;

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: locks } = await supabase
      .from('po_receiving_locks')
      .select('user_id, user_email, locked_at, last_heartbeat')
      .eq('po_id', poId)
      .neq('user_id', currentUserId)
      .gte('last_heartbeat', thirtyMinAgo);

    if (locks && locks.length > 0) {
      return {
        locked_by_email: locks[0].user_email,
        locked_at: locks[0].locked_at,
      };
    }
    return null;
  }, [currentUserId, supabase]);

  // Acquire a lock on a PO for the current user
  const acquirePOLock = useCallback(async (poId: string, poNumber: string) => {
    if (!currentUserId || activeLocks.has(poId)) return;

    // First check if another user has it
    const existingLock = await checkPOLock(poId);
    if (existingLock) {
      setLockConflict({
        po_number: poNumber,
        locked_by: existingLock.locked_by_email,
        locked_since: existingLock.locked_at,
      });
      return false;
    }

    // Clean up any expired locks for this PO, then insert ours
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabase
      .from('po_receiving_locks')
      .delete()
      .eq('po_id', poId)
      .lt('last_heartbeat', thirtyMinAgo);

    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id;

    await supabase.from('po_receiving_locks').upsert({
      po_id: poId,
      user_id: currentUserId,
      user_email: currentUserEmail,
      tenant_id: tenantId,
      locked_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
    }, { onConflict: 'po_id,user_id' });

    setActiveLocks((prev) => new Set(prev).add(poId));
    return true;
  }, [currentUserId, currentUserEmail, activeLocks, checkPOLock, supabase]);

  // Release all locks for the current user
  const releaseAllLocks = useCallback(async () => {
    if (!currentUserId) return;
    await supabase
      .from('po_receiving_locks')
      .delete()
      .eq('user_id', currentUserId);
    setActiveLocks(new Set());
  }, [currentUserId, supabase]);

  // ─── Effects ────────────────────────────────────────────

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), TOAST_DURATION);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (phase === 'scanning' && scanRef.current && !cameraActive) {
      scanRef.current.focus();
    }
  }, [phase, cameraActive]);

  // Cleanup camera on unmount or phase change
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    };
  }, []);

  // ─── Computed ───────────────────────────────────────────

  const groupedByPO = useMemo(() => {
    const groups: Record<
      string,
      {
        po_id: string | null;
        po_number: string | null;
        vendor: string;
        items: SessionItem[];
      }
    > = {};

    Object.values(sessionItems).forEach((item) => {
      const groupKey = item.po_id || `no_po__${item.vendor}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          po_id: item.po_id,
          po_number: item.po_number,
          vendor: item.vendor,
          items: [],
        };
      }
      groups[groupKey].items.push(item);
    });

    return groups;
  }, [sessionItems]);

  const totalScanned = Object.values(sessionItems).reduce(
    (sum, i) => sum + i.quantity,
    0
  );
  const poCount = new Set(
    Object.values(sessionItems)
      .filter((i) => i.po_id)
      .map((i) => i.po_id)
  ).size;

  // ─── Session Handlers ──────────────────────────────────

  const handleStartSession = async () => {
    setSessionItems({});
    setScanCount(0);
    setProcessResults(null);
    setLockConflict(null);
    await releaseAllLocks(); // clean up any stale locks from previous session
    setPhase('scanning');
  };

  const handleEndSession = () => {
    if (Object.keys(sessionItems).length === 0) {
      setToast({ message: 'No items scanned yet', type: 'error' });
      return;
    }
    stopCamera();
    setPhase('reviewing');
  };

  // ─── Add to Session Helper ─────────────────────────────

  const addToSession = (params: Omit<SessionItem, 'key' | 'quantity'>) => {
    const key = `${params.po_id || 'no_po'}__${params.variant_id}`;

    setSessionItems((prev) => {
      if (prev[key]) {
        return {
          ...prev,
          [key]: { ...prev[key], quantity: prev[key].quantity + 1 },
        };
      }
      return {
        ...prev,
        [key]: { ...params, key, quantity: 1 },
      };
    });
  };

  // ─── Scan Handler ──────────────────────────────────────

  const handleScan = useCallback(async (value: string) => {
    const barcode = value.trim();
    if (!barcode) return;

    setScanCount((c) => c + 1);

    // 1. Build barcode variants to handle UPC-12 vs EAN-13 format differences
    //    Phone cameras often read 13 digits (EAN-13), USB scanners read 12 (UPC-A)
    const barcodesToTry = [barcode];
    if (barcode.startsWith('0') && barcode.length === 13) {
      // EAN-13 with leading zero → try as UPC-12
      barcodesToTry.push(barcode.substring(1));
    } else if (/^\d{12}$/.test(barcode)) {
      // UPC-12 → try as EAN-13 with leading zero
      barcodesToTry.push('0' + barcode);
    }

    // Build OR filter for all barcode variants
    const orFilters = barcodesToTry
      .flatMap(b => [`barcode.eq.${b}`, `sku.eq.${b}`])
      .join(',');

    const { data: variants } = await supabase
      .from('product_variants')
      .select(
        `
        id, product_id, sku, barcode, title,
        option1, option2, option3, cost_price,
        products!inner ( id, title, vendor )
      `
      )
      .or(orFilters)
      .limit(1);

    if (!variants || variants.length === 0) {
      triggerFeedback('error');
      setToast({ message: `Barcode "${barcode}" not found`, type: 'error' });
      return;
    }

    const v = variants[0] as any;
    const productName = v.products?.title || '';
    const vendor = v.products?.vendor || '';
    const variantName =
      v.title ||
      [v.option1, v.option2, v.option3].filter(Boolean).join(' / ') ||
      'Default';

    // 2. Find ALL PO line items for this variant, filter in JS
    const { data: poItems } = await supabase
      .from('purchase_order_items')
      .select(
        `
        id, po_id, quantity, quantity_received, unit_cost,
        purchase_orders!inner ( id, po_number, vendor, status )
      `
      )
      .eq('variant_id', v.id);

    // Filter to open POs with remaining qty (accounting for session)
    const matchingItems = (poItems || [])
      .filter(
        (pi: any) =>
          pi.purchase_orders &&
          ['submitted', 'partial'].includes(pi.purchase_orders.status)
      )
      .map((pi: any) => {
        const sessionKey = `${pi.po_id}__${v.id}`;
        const sessionQty = sessionItems[sessionKey]?.quantity || 0;
        const remaining =
          pi.quantity - (pi.quantity_received || 0) - sessionQty;
        return {
          po_id: pi.po_id,
          po_number: pi.purchase_orders.po_number,
          line_item_id: pi.id,
          ordered_qty: pi.quantity,
          already_received: pi.quantity_received || 0,
          remaining,
          unit_cost: pi.unit_cost,
        };
      })
      .filter((pi: any) => pi.remaining > 0);

    // 3. Route based on matches
    if (matchingItems.length === 1) {
      const match = matchingItems[0];

      // Session locking: check if another user has this PO locked
      if (match.po_id) {
        const lockOk = await acquirePOLock(match.po_id, match.po_number);
        if (lockOk === false) {
          triggerFeedback('error');
          return; // lock conflict modal will show
        }
      }

      addToSession({
        barcode,
        product_name: productName,
        variant_name: variantName,
        sku: v.sku || '',
        variant_id: v.id,
        product_id: v.product_id,
        vendor,
        po_id: match.po_id,
        po_number: match.po_number,
        line_item_id: match.line_item_id,
        unit_cost: match.unit_cost,
        ordered_qty: match.ordered_qty,
        already_received: match.already_received,
        added_during_receiving: false,
      });
      triggerFeedback('success');
      setToast({
        message: `+1 ${productName} — ${variantName} → ${match.po_number}`,
        type: 'success',
      });
    } else if (matchingItems.length > 1) {
      triggerFeedback('warning');
      setPoPickerData({
        variant: {
          product_name: productName,
          variant_name: variantName,
          barcode,
          sku: v.sku || '',
          variant_id: v.id,
          product_id: v.product_id,
          vendor,
          unit_cost: v.cost_price || 0,
        },
        choices: matchingItems,
      });
    } else {
      // No matching PO — add to "no PO" bucket
      const noPOKey = `no_po__${v.id}`;
      if (sessionItems[noPOKey]) {
        setSessionItems((prev) => ({
          ...prev,
          [noPOKey]: { ...prev[noPOKey], quantity: prev[noPOKey].quantity + 1 },
        }));
        triggerFeedback('warning');
        setToast({
          message: `+1 ${productName} — ${variantName} (no matching PO)`,
          type: 'info',
        });
      } else {
        setSessionItems((prev) => ({
          ...prev,
          [noPOKey]: {
            key: noPOKey,
            barcode,
            product_name: productName,
            variant_name: variantName,
            sku: v.sku || '',
            variant_id: v.id,
            product_id: v.product_id,
            vendor,
            po_id: null,
            po_number: null,
            line_item_id: null,
            quantity: 1,
            unit_cost: v.cost_price || 0,
            ordered_qty: 0,
            already_received: 0,
            added_during_receiving: true,
          },
        }));
        triggerFeedback('warning');
        setToast({
          message: `${productName} — ${variantName} not on any open PO`,
          type: 'info',
        });
      }
    }
  }, [sessionItems, supabase, triggerFeedback]);

  // ─── Camera Handlers ───────────────────────────────────

  const startCamera = async () => {
    setCameraActive(true);

    // Small delay to let the DOM render the reader div
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            const now = Date.now();
            // Debounce: ignore same barcode within 3 seconds
            if (
              decodedText === lastScannedRef.current &&
              now - lastScannedTimeRef.current < 3000
            ) {
              return;
            }
            lastScannedRef.current = decodedText;
            lastScannedTimeRef.current = now;
            handleScan(decodedText);
          },
          () => {
            // QR scan error — ignore (normal when no barcode in view)
          }
        );
      } catch (err) {
        console.error('Camera error:', err);
        setToast({
          message: 'Could not access camera. Check permissions.',
          type: 'error',
        });
        setCameraActive(false);
      }
    }, 100);
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  // ─── PO Picker Handler ─────────────────────────────────

  const handlePickPO = async (choice: POChoice) => {
    if (!poPickerData) return;
    const vv = poPickerData.variant;

    // Session locking: check if another user has this PO locked
    const lockOk = await acquirePOLock(choice.po_id, choice.po_number);
    if (lockOk === false) {
      triggerFeedback('error');
      setPoPickerData(null);
      return; // lock conflict modal will show
    }

    addToSession({
      barcode: vv.barcode,
      product_name: vv.product_name,
      variant_name: vv.variant_name,
      sku: vv.sku,
      variant_id: vv.variant_id,
      product_id: vv.product_id,
      vendor: vv.vendor,
      po_id: choice.po_id,
      po_number: choice.po_number,
      line_item_id: choice.line_item_id,
      unit_cost: choice.unit_cost || vv.unit_cost,
      ordered_qty: choice.ordered_qty,
      already_received: choice.already_received,
      added_during_receiving: false,
    });

    setToast({
      message: `+1 ${vv.product_name} — ${vv.variant_name} → ${choice.po_number}`,
      type: 'success',
    });
    setPoPickerData(null);
  };

  // ─── Confirm Receiving ─────────────────────────────────

  const handleConfirm = async () => {
    setPhase('processing');
    const now = new Date().toISOString();
    const receivedBy = 'staff';

    // Get tenant info for inventory writes
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const tenantId = authUser?.user_metadata?.tenant_id;


    const posUpdated = new Set<string>();
    let itemsReceived = 0;
    let quickPOCreated: string | null = null;

    try {
      // Split items: with PO vs without PO
      const byPO: Record<string, SessionItem[]> = {};
      const noPOItems: SessionItem[] = [];

      Object.values(sessionItems).forEach((item) => {
        if (item.po_id) {
          if (!byPO[item.po_id]) byPO[item.po_id] = [];
          byPO[item.po_id].push(item);
        } else {
          noPOItems.push(item);
        }
      });

      // ── Process existing PO items ──────────────────────
      for (const [poId, items] of Object.entries(byPO)) {
        for (const item of items) {
          const newReceived = item.already_received + item.quantity;
          const newBackorder = Math.max(0, item.ordered_qty - newReceived);
          const lineStatus =
            newReceived >= item.ordered_qty ? 'received' : 'partial';

          await supabase
            .from('purchase_order_items')
            .update({
              quantity_received: newReceived,
              backorder_qty: newBackorder,
              line_status: lineStatus,
              received_at: now,
              received_by: receivedBy,
            })
            .eq('id', item.line_item_id);

                    await supabase.from('receiving_history').insert({
            po_item_id: item.line_item_id,
            quantity_received: item.quantity,
            received_at: now,
            received_by: receivedBy,
          });

          // ── Update inventory_levels ──
          let storeId: string | null = null;
          const { data: poData } = await supabase
            .from('purchase_orders')
            .select('location')
            .eq('id', item.po_id)
            .single();

          if (poData?.location) {
            const { data: loc } = await supabase
              .from('locations')
              .select('id')
              .eq('name', poData.location)
              .eq('tenant_id', tenantId)
              .single();
            storeId = loc?.id || null;
          }

          const { data: existingLevel } = await supabase
            .from('inventory_levels')
            .select('id, quantity_on_hand, quantity_committed')
            .eq('product_variant_id', item.variant_id)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          const prevQty = existingLevel?.quantity_on_hand || 0;
          const committed = existingLevel?.quantity_committed || 0;
          const newQty = prevQty + item.quantity;

          if (existingLevel) {
            await supabase.from('inventory_levels').update({
              quantity_on_hand: newQty,
              quantity_available: newQty - committed,
              updated_at: now,
            }).eq('id', existingLevel.id);
          } else {
            await supabase.from('inventory_levels').insert({
              tenant_id: tenantId,
              store_id: storeId,
              product_variant_id: item.variant_id,
              quantity_on_hand: item.quantity,
              quantity_committed: 0,
              quantity_available: item.quantity,
            });
          }

          // ── Log inventory movement ──
          await supabase.from('inventory_movements').insert({
            tenant_id: tenantId,
            store_id: storeId,
            product_variant_id: item.variant_id,
            movement_type: 'receiving',
            quantity: item.quantity,
            reference_type: 'purchase_order',
            reference_id: item.po_id,
            performed_by: currentUserId,
            balance_after: newQty,
            notes: `Received on PO ${item.po_number}`,
          });

          itemsReceived += item.quantity;

        }

        // Recalculate PO status
        const { data: allItems } = await supabase
          .from('purchase_order_items')
          .select('quantity, quantity_received')
          .eq('po_id', poId);

        if (allItems) {
          const allDone = allItems.every(
            (i: any) => (i.quantity_received || 0) >= i.quantity
          );
          const anyDone = allItems.some(
            (i: any) => (i.quantity_received || 0) > 0
          );
          const newStatus = allDone
            ? 'received'
            : anyDone
              ? 'partial'
              : 'submitted';

          await supabase
            .from('purchase_orders')
            .update({ status: newStatus, updated_at: now })
            .eq('id', poId);
        }

        posUpdated.add(poId);
      }

      // ── Process items without PO — Quick PO ────────────
      if (noPOItems.length > 0) {
        const byVendor: Record<string, SessionItem[]> = {};
        noPOItems.forEach((item) => {
          if (!byVendor[item.vendor]) byVendor[item.vendor] = [];
          byVendor[item.vendor].push(item);
        });

        for (const [vendor, vendorItems] of Object.entries(byVendor)) {
          const year = new Date().getFullYear();
          const { count } = await supabase
            .from('purchase_orders')
            .select('*', { count: 'exact', head: true });

          const poNumber = `PO-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
          const totalCost = vendorItems.reduce(
            (sum, i) => sum + i.unit_cost * i.quantity,
            0
          );
          const totalItems = vendorItems.reduce(
            (sum, i) => sum + i.quantity,
            0
          );

          const { data: newPO } = await supabase
            .from('purchase_orders')
            .insert({
              po_number: poNumber,
              vendor,
              status: 'received',
              total_items: totalItems,
              total_cost: totalCost,
              notes: 'Quick PO — created during receiving',
              created_at: now,
              updated_at: now,
            })
            .select()
            .single();

          if (!newPO) continue;
          quickPOCreated = newPO.po_number;

          for (const item of vendorItems) {
            const { data: lineItem } = await supabase
              .from('purchase_order_items')
              .insert({
                po_id: newPO.id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                product_name: item.product_name,
                variant_name: item.variant_name,
                sku: item.sku,
                barcode: item.barcode,
                quantity: item.quantity,
                unit_cost: item.unit_cost,
                quantity_received: item.quantity,
                backorder_qty: 0,
                line_status: 'received',
                added_during_receiving: true,
                received_at: now,
                received_by: receivedBy,
              })
              .select()
              .single();

                        if (lineItem) {
              await supabase.from('receiving_history').insert({
                po_item_id: lineItem.id,
                quantity_received: item.quantity,
                received_at: now,
                received_by: receivedBy,
              });

              // ── Update inventory_levels (Quick PO) ──
              const { data: existingLevel2 } = await supabase
                .from('inventory_levels')
                .select('id, quantity_on_hand, quantity_committed')
                .eq('product_variant_id', item.variant_id)
                .eq('tenant_id', tenantId)
                .maybeSingle();

              const prevQty2 = existingLevel2?.quantity_on_hand || 0;
              const committed2 = existingLevel2?.quantity_committed || 0;
              const newQty2 = prevQty2 + item.quantity;

              if (existingLevel2) {
                await supabase.from('inventory_levels').update({
                  quantity_on_hand: newQty2,
                  quantity_available: newQty2 - committed2,
                  updated_at: now,
                }).eq('id', existingLevel2.id);
              } else {
                await supabase.from('inventory_levels').insert({
                  tenant_id: tenantId,
                  store_id: null,
                  product_variant_id: item.variant_id,
                  quantity_on_hand: item.quantity,
                  quantity_committed: 0,
                  quantity_available: item.quantity,
                });
              }

              // ── Log inventory movement (Quick PO) ──
              await supabase.from('inventory_movements').insert({
                tenant_id: tenantId,
                store_id: null,
                product_variant_id: item.variant_id,
                movement_type: 'receiving',
                quantity: item.quantity,
                reference_type: 'purchase_order',
                reference_id: newPO.id,
                performed_by: currentUserId,
                balance_after: newQty2,
                notes: `Received on Quick PO ${newPO.po_number}`,
              });
            }
            itemsReceived += item.quantity;

          }
          posUpdated.add(newPO.id);
        }
      }

      // Release all PO locks after successful processing
      await releaseAllLocks();

      setProcessResults({
        posUpdated: posUpdated.size,
        itemsReceived,
        quickPOCreated,
      });
      setPhase('done');
    } catch (err) {
      setToast({
        message: 'Error processing receiving session',
        type: 'error',
      });
      setPhase('reviewing');
    }
  };

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="max-w-4xl">
      {/* Screen Flash Overlay */}
      {flashColor && (
        <div
          className="fixed inset-0 z-[100] pointer-events-none transition-opacity duration-300"
          style={{ backgroundColor: flashColor }}
        />
      )}
      {/* Lock Conflict Modal */}
      {lockConflict && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                PO Locked by Another User
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                <strong>{lockConflict.po_number}</strong> is currently being
                received by <strong>{lockConflict.locked_by}</strong>
                <br />
                <span className="text-xs text-gray-400">
                  Started {new Date(lockConflict.locked_since).toLocaleTimeString()}
                </span>
              </p>
              <p className="text-xs text-gray-500 mb-4">
                To prevent duplicate receiving, only one person can work on a PO
                at a time. The lock expires after 30 minutes of inactivity.
              </p>
              <button
                onClick={() => setLockConflict(null)}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700"
              >
                Got it — I'll scan a different item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Receiving</h1>
          <p className="text-gray-500 text-sm mt-1">
            Scan items to receive — auto-matched to open purchase orders
          </p>
        </div>
        {phase === 'idle' && (
          <button
            onClick={handleStartSession}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Receiving Session
          </button>
        )}
        {phase === 'scanning' && (
          <div className="flex gap-3">
            <button
              onClick={handleEndSession}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              End Session & Review
            </button>
            <button
              onClick={() => {
                stopCamera();
                setPhase('idle');
                setSessionItems({});
                setScanCount(0);
              }}
              className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* IDLE PHASE                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      {phase === 'idle' && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-xl font-semibold mb-2">Ready to Receive</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Click &quot;Start Receiving Session&quot; to begin scanning items.
            The system will automatically match barcodes to open purchase
            orders.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* SCANNING PHASE                                     */}
      {/* ═══════════════════════════════════════════════════ */}
      {phase === 'scanning' && (
        <>
          {/* Scan Input */}
          <div className="bg-white rounded-xl border p-4 mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-7 h-7 text-gray-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="4" width="3" height="16" />
                <rect x="6" y="4" width="1.5" height="16" />
                <rect x="9" y="4" width="3" height="16" />
                <rect x="14" y="4" width="1.5" height="16" />
                <rect x="17" y="4" width="1.5" height="16" />
                <rect x="20" y="4" width="3" height="16" />
                <line x1="5" y1="21" x2="5" y2="22" />
                <line x1="8" y1="21" x2="8" y2="22" />
                <line x1="13" y1="21" x2="13" y2="22" />
                <line x1="16" y1="21" x2="16" y2="22" />
                <line x1="19" y1="21" x2="19" y2="22" />
              </svg>
              <input
                ref={scanRef}
                type="text"
                placeholder="Scan barcode or type SKU..."
                className="flex-1 text-lg px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScan((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>

            {/* Camera Toggle Button */}
            <div className="mt-3">
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  <span className="text-xl">📷</span>
                  Camera Scan
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="w-full flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-3 rounded-lg hover:bg-red-600 transition-colors font-medium"
                >
                  <span className="text-xl">✕</span>
                  Stop Camera
                </button>
              )}
            </div>

            {/* Camera Preview */}
            {cameraActive && (
              <div className="mt-3 rounded-lg overflow-hidden border-2 border-indigo-300">
                <div id="qr-reader" style={{ width: '100%' }} />
                <p className="text-center text-sm text-gray-500 py-2 bg-gray-50">
                  Point camera at barcode — scans automatically
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-6 mt-3 text-sm">
              <span className="text-gray-500">
                Scans:{' '}
                <span className="font-semibold text-gray-900">{scanCount}</span>
              </span>
              <span className="text-gray-500">
                Items:{' '}
                <span className="font-semibold text-gray-900">
                  {totalScanned}
                </span>
              </span>
              <span className="text-gray-500">
                POs:{' '}
                <span className="font-semibold text-gray-900">{poCount}</span>
              </span>
              {Object.values(sessionItems).some((i) => !i.po_id) && (
                <span className="text-amber-600 font-medium">
                  ⚠{' '}
                  {Object.values(sessionItems).filter((i) => !i.po_id).length}{' '}
                  item(s) without PO
                </span>
              )}
            </div>
          </div>

          {/* Scanned Items Grouped by PO */}
          {Object.keys(groupedByPO).length > 0 && (
            <div className="space-y-4">
              {Object.entries(groupedByPO).map(([groupKey, group]) => (
                <div
                  key={groupKey}
                  className="bg-white rounded-xl border overflow-hidden"
                >
                  <div
                    className={`px-4 py-3 border-b flex items-center justify-between ${
                      group.po_id ? 'bg-blue-50' : 'bg-amber-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {group.po_id ? (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                          {group.po_number}
                        </span>
                      ) : (
                        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                          No PO
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-600">
                        {group.vendor}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {group.items.reduce((s, i) => s + i.quantity, 0)} item(s)
                    </span>
                  </div>
                  <div className="divide-y">
                    {group.items.map((item) => (
                      <div
                        key={item.key}
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.variant_name}
                          </p>
                          {item.sku && (
                            <p className="text-xs text-gray-400">
                              SKU: {item.sku}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-gray-900">
                            ×{item.quantity}
                          </span>
                          {item.po_id && (
                            <p className="text-xs text-gray-400">
                              of {item.ordered_qty} ordered
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(sessionItems).length === 0 && (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              <p className="text-lg">Start scanning items...</p>
              <p className="text-sm mt-1">
                Each barcode will be automatically matched to an open PO
              </p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* REVIEWING PHASE                                    */}
      {/* ═══════════════════════════════════════════════════ */}
      {phase === 'reviewing' && (
        <>
          <div className="bg-white rounded-xl border p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4">
              📋 Receiving Summary
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {totalScanned}
                </p>
                <p className="text-sm text-blue-600">Total Items</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{poCount}</p>
                <p className="text-sm text-green-600">POs Updated</p>
              </div>
              {Object.values(sessionItems).some((i) => !i.po_id) && (
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">
                    {Object.values(sessionItems)
                      .filter((i) => !i.po_id)
                      .reduce((s, i) => s + i.quantity, 0)}
                  </p>
                  <p className="text-sm text-amber-600">Quick PO Items</p>
                </div>
              )}
            </div>

            {/* Detailed breakdown */}
            <div className="space-y-4">
              {Object.entries(groupedByPO).map(([groupKey, group]) => (
                <div
                  key={groupKey}
                  className="border rounded-lg overflow-hidden"
                >
                  <div
                    className={`px-4 py-2.5 flex items-center justify-between border-b ${
                      group.po_id ? 'bg-blue-50' : 'bg-amber-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {group.po_id ? (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                          {group.po_number}
                        </span>
                      ) : (
                        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                          Quick PO will be created
                        </span>
                      )}
                      <span className="text-sm text-gray-600">
                        {group.vendor}
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">
                          Variant
                        </th>
                        <th className="text-center px-4 py-2 text-xs text-gray-500 uppercase">
                          Receiving
                        </th>
                        <th className="text-right px-4 py-2 text-xs text-gray-500 uppercase">
                          Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.items.map((item) => (
                        <tr key={item.key}>
                          <td className="px-4 py-2 font-medium">
                            {item.product_name}
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {item.variant_name}
                          </td>
                          <td className="px-4 py-2 text-center font-semibold">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-right">
                            ${(item.unit_cost * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setPhase('scanning')}
              className="px-5 py-2.5 border rounded-lg hover:bg-gray-50"
            >
              ← Back to Scanning
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              ✓ Confirm Receiving
            </button>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* PROCESSING PHASE                                   */}
      {/* ═══════════════════════════════════════════════════ */}
      {phase === 'processing' && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <h2 className="text-lg font-semibold">Processing...</h2>
          <p className="text-gray-500 text-sm mt-1">
            Updating purchase orders and inventory
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DONE PHASE                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      {phase === 'done' && processResults && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold mb-2">Receiving Complete</h2>
          <div className="flex justify-center gap-6 mb-6">
            <div>
              <span className="text-2xl font-bold text-green-700">
                {processResults.itemsReceived}
              </span>
              <p className="text-sm text-gray-500">Items Received</p>
            </div>
            <div>
              <span className="text-2xl font-bold text-blue-700">
                {processResults.posUpdated}
              </span>
              <p className="text-sm text-gray-500">POs Updated</p>
            </div>
          </div>
          {processResults.quickPOCreated && (
            <p className="text-sm text-amber-600 mb-4">
              📋 Quick PO{' '}
              <strong>{processResults.quickPOCreated}</strong> was created for
              items without an existing PO
            </p>
          )}
          <button
            onClick={handleStartSession}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            Start New Session
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* PO PICKER MODAL                                    */}
      {/* ═══════════════════════════════════════════════════ */}
      {poPickerData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold mb-1">
              Item Found on Multiple POs
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{poPickerData.variant.product_name}</strong> —{' '}
              {poPickerData.variant.variant_name}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Which PO should this item be received against?
            </p>
            <div className="space-y-2 mb-4">
              {poPickerData.choices.map((choice) => (
                <button
                  key={choice.po_id}
                  onClick={() => handlePickPO(choice)}
                  className="w-full text-left border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-600">
                      {choice.po_number}
                    </span>
                    <span className="text-sm text-gray-500">
                      {choice.already_received} of {choice.ordered_qty}{' '}
                      received — {choice.remaining} remaining
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPoPickerData(null)}
              className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
