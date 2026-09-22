import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';

const ORDER_STATUSES: OrderStatus[] = [
  'OFFER_SELECTED',
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PRODUCTION',
  'SAMPLE_REVIEW',
  'PRODUCTION_COMPLETED',
  'RECEIVED_AT_HUB',
  'QC_COMPLETED',
  'READY_FOR_DELIVERY',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
];

export const adminOrderStatusSchema = z.object({
  to_status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
  evidence_file_id: z.string().uuid().optional(),
  note: z.string().trim().max(1000).optional(),
});
