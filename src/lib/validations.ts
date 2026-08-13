import { z } from 'zod';

export const ItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  category: z.string().optional().default('General'),
  quantity: z.number().int('Quantity must be an integer').min(0, 'Quantity cannot be negative').default(0),
  threshold: z.number().int('Threshold must be an integer').min(0, 'Threshold cannot be negative').default(5),
  price: z.number().min(0, 'Price cannot be negative').default(0),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const StockAdjustmentSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  note: z.string().optional().nullable(),
});

export type ItemInput = z.infer<typeof ItemSchema>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
