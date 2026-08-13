import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SEED_SUPPLIERS = [
  { name: 'Apex Supply Co.', contact: 'Sarah Jenkins', phone: '+1 (555) 234-5678', email: 'orders@apexsupply.com', address: '100 Industrial Pkwy, Chicago, IL' },
  { name: 'EcoCraft Goods', contact: 'David Lin', phone: '+1 (555) 876-5432', email: 'supply@ecocraft.io', address: '45 Green St, Portland, OR' },
  { name: 'Nexus Tech Imports', contact: 'Alex Rivera', phone: '+1 (555) 345-6789', email: 'sales@nexustech.com', address: '88 Tech Blvd, Austin, TX' },
  { name: 'Global Beverages Ltd', contact: 'Maria Rossi', phone: '+1 (555) 987-6543', email: 'info@globalbev.com', address: '12 Harbor Rd, Seattle, WA' },
];

const SEED_ITEMS = [
  { name: 'Artisan Ceramic Mug', sku: 'HW-001', category: 'Home Goods', quantity: 142, threshold: 20, price: 18.99, location: 'Aisle 1, Shelf A', description: 'Handcrafted ceramic mugs, microwave and dishwasher safe.', supplierIdx: 1 },
  { name: 'Organic Cotton Throw', sku: 'TX-089', category: 'Textiles', quantity: 12, threshold: 15, price: 45.00, location: 'Aisle 3, Shelf C', description: '100% organic cotton throw blanket, available in 4 colors.', supplierIdx: 1 },
  { name: 'Matte Black Desk Lamp', sku: 'LT-042', category: 'Lighting', quantity: 0, threshold: 5, price: 79.99, location: 'Aisle 5, Shelf B', description: 'LED desk lamp with adjustable arm, USB-C charging port.', supplierIdx: 2 },
  { name: 'Minimalist Wall Clock', sku: 'DC-112', category: 'Decor', quantity: 45, threshold: 10, price: 34.99, location: 'Aisle 2, Shelf D', description: 'Silent quartz movement, 30cm diameter, brushed aluminum.', supplierIdx: 0 },
  { name: 'Premium Espresso Beans', sku: 'BEV-049', category: 'Beverages', quantity: 145, threshold: 50, price: 24.99, location: 'Aisle 4, Shelf B', description: 'Premium dark roast espresso beans sourced from Colombia.', supplierIdx: 3 },
  { name: 'Bamboo Cutting Board', sku: 'HW-203', category: 'Home Goods', quantity: 8, threshold: 10, price: 22.50, location: 'Aisle 1, Shelf C', description: 'Extra-large bamboo cutting board with juice groove.', supplierIdx: 1 },
  { name: 'Wireless Earbuds Pro', sku: 'EL-088', category: 'Electronics', quantity: 0, threshold: 3, price: 89.99, location: 'Aisle 6, Shelf A', description: 'True wireless earbuds, ANC, 30hr battery life.', supplierIdx: 2 },
  { name: 'Linen Napkin Set (6)', sku: 'TX-034', category: 'Textiles', quantity: 34, threshold: 12, price: 19.99, location: 'Aisle 3, Shelf A', description: 'Pure linen napkins, pre-washed, set of 6 assorted colors.', supplierIdx: 1 },
  { name: 'Scented Soy Candle', sku: 'DC-201', category: 'Decor', quantity: 60, threshold: 15, price: 16.00, location: 'Aisle 2, Shelf A', description: 'Hand-poured soy wax, 40hr burn time, cedar & amber scent.', supplierIdx: 0 },
  { name: 'Cold Brew Coffee Kit', sku: 'BEV-111', category: 'Beverages', quantity: 4, threshold: 8, price: 38.00, location: 'Aisle 4, Shelf A', description: '64oz mason jar cold brew system with reusable filter.', supplierIdx: 3 },
  { name: 'Ergonomic Mesh Chair', sku: 'FUR-015', category: 'Furniture', quantity: 18, threshold: 5, price: 189.99, location: 'Aisle 7, Row 1', description: 'High-back mesh office chair with lumbar support.', supplierIdx: 0 },
  { name: 'Smart RGB LED Strip', sku: 'EL-102', category: 'Electronics', quantity: 75, threshold: 20, price: 29.99, location: 'Aisle 6, Shelf B', description: 'Wi-Fi enabled 16ft LED strip light, app & voice controlled.', supplierIdx: 2 },
];

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const existingCount = await prisma.item.count();
    if (existingCount > 0 && !force) {
      return NextResponse.json({ message: 'Database already populated', count: existingCount });
    }

    // Clean existing data if forced
    if (force) {
      await prisma.sale.deleteMany({});
      await prisma.stockMovement.deleteMany({});
      await prisma.item.deleteMany({});
      await prisma.supplier.deleteMany({});
    }

    // 1. Create Suppliers
    const suppliers = [];
    for (const sup of SEED_SUPPLIERS) {
      const createdSup = await prisma.supplier.create({ data: sup });
      suppliers.push(createdSup);
    }

    // 2. Create Items
    const createdItems = [];
    for (const itemData of SEED_ITEMS) {
      const { supplierIdx, ...item } = itemData;
      const supplier = suppliers[supplierIdx];
      const createdItem = await prisma.item.create({
        data: {
          ...item,
          supplierId: supplier ? supplier.id : null,
        },
      });
      createdItems.push(createdItem);

      // Initial Stock Movement
      if (createdItem.quantity > 0) {
        await prisma.stockMovement.create({
          data: {
            itemId: createdItem.id,
            type: 'IN',
            quantity: createdItem.quantity,
            note: 'Initial inventory setup',
            createdAt: new Date(Date.now() - 14 * 86400000),
          },
        });
      }
    }

    // 3. Generate Realistic Sales & Movements History over past 14 days
    const now = Date.now();
    let salesCount = 0;

    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const dayTimestamp = new Date(now - dayOffset * 86400000);
      // Generate 2-5 sales per day
      const salesPerDay = Math.floor(Math.random() * 4) + 2;

      for (let s = 0; s < salesPerDay; s++) {
        // Pick a random healthy or available item
        const item = createdItems[Math.floor(Math.random() * createdItems.length)];
        const qtySold = Math.floor(Math.random() * 3) + 1;
        const total = qtySold * item.price;
        const saleDate = new Date(dayTimestamp.getTime() + Math.random() * 43200000);

        await prisma.sale.create({
          data: {
            itemId: item.id,
            quantity: qtySold,
            unitPrice: item.price,
            total,
            note: `POS Transaction #${1000 + salesCount + 1}`,
            soldAt: saleDate,
          },
        });

        await prisma.stockMovement.create({
          data: {
            itemId: item.id,
            type: 'OUT',
            quantity: qtySold,
            note: `Automated Sale (${qtySold} units)`,
            createdAt: saleDate,
          },
        });

        salesCount++;
      }
    }

    return NextResponse.json({
      message: 'Demo dataset successfully generated!',
      suppliersCreated: suppliers.length,
      itemsCreated: createdItems.length,
      salesCreated: salesCount,
    });
  } catch (error: any) {
    console.error('Error seeding DB:', error);
    return NextResponse.json({ error: 'Failed to seed database', detail: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
