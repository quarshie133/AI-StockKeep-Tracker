import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SEED_ITEMS = [
  { name: 'Artisan Ceramic Mug', sku: 'HW-001', category: 'Home Goods', quantity: 142, threshold: 20, price: 18.99, location: 'Aisle 1, Shelf A', description: 'Handcrafted ceramic mugs, microwave and dishwasher safe.' },
  { name: 'Organic Cotton Throw', sku: 'TX-089', category: 'Textiles', quantity: 12, threshold: 15, price: 45.00, location: 'Aisle 3, Shelf C', description: '100% organic cotton throw blanket, available in 4 colors.' },
  { name: 'Matte Black Desk Lamp', sku: 'LT-042', category: 'Lighting', quantity: 0, threshold: 5, price: 79.99, location: 'Aisle 5, Shelf B', description: 'LED desk lamp with adjustable arm, USB-C charging port.' },
  { name: 'Minimalist Wall Clock', sku: 'DC-112', category: 'Decor', quantity: 45, threshold: 10, price: 34.99, location: 'Aisle 2, Shelf D', description: 'Silent quartz movement, 30cm diameter, brushed aluminum.' },
  { name: 'Premium Espresso Beans', sku: 'BEV-049', category: 'Beverages', quantity: 145, threshold: 50, price: 24.99, location: 'Aisle 4, Shelf B', description: 'Premium dark roast espresso beans sourced from Colombia.' },
  { name: 'Bamboo Cutting Board', sku: 'HW-203', category: 'Home Goods', quantity: 8, threshold: 10, price: 22.50, location: 'Aisle 1, Shelf C', description: 'Extra-large bamboo cutting board with juice groove.' },
  { name: 'Wireless Earbuds Pro', sku: 'EL-088', category: 'Electronics', quantity: 0, threshold: 3, price: 89.99, location: 'Aisle 6, Shelf A', description: 'True wireless earbuds, ANC, 30hr battery life.' },
  { name: 'Linen Napkin Set (6)', sku: 'TX-034', category: 'Textiles', quantity: 34, threshold: 12, price: 19.99, location: 'Aisle 3, Shelf A', description: 'Pure linen napkins, pre-washed, set of 6 assorted colors.' },
  { name: 'Scented Soy Candle', sku: 'DC-201', category: 'Decor', quantity: 60, threshold: 15, price: 16.00, location: 'Aisle 2, Shelf A', description: 'Hand-poured soy wax, 40hr burn time, cedar & amber scent.' },
  { name: 'Cold Brew Coffee Kit', sku: 'BEV-111', category: 'Beverages', quantity: 4, threshold: 8, price: 38.00, location: 'Aisle 4, Shelf A', description: '64oz mason jar cold brew system with reusable filter.' },
];

export async function POST() {
  try {
    const count = await prisma.item.count();
    if (count > 0) {
      return NextResponse.json({ message: 'Database already seeded', count });
    }

    for (const item of SEED_ITEMS) {
      const created = await prisma.item.create({ data: item });
      if (created.quantity > 0) {
        await prisma.stockMovement.create({
          data: {
            itemId: created.id,
            type: 'IN',
            quantity: created.quantity,
            note: 'Initial inventory seed',
          },
        });
      }
    }

    return NextResponse.json({ message: 'Database seeded successfully', seededCount: SEED_ITEMS.length });
  } catch (error) {
    console.error('Error seeding DB:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
