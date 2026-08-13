import { prisma } from './prisma';

interface LowStockNotificationItem {
  name: string;
  sku: string;
  quantity: number;
  threshold: number;
}

export async function checkAndSendLowStockNotification(item: LowStockNotificationItem) {
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.notifyEmail || !settings.emailAddress || !settings.resendApiKey) {
      return;
    }

    const { name, sku, quantity, threshold } = item;
    const recipient = settings.emailAddress;
    const apiKey = settings.resendApiKey;

    const htmlContent = `
      <div style="font-family: 'Hanken Grotesk', Arial, sans-serif; padding: 24px; background: #f8f9fa; color: #191c1d; max-width: 500px; margin: 0 auto; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #005440; margin: 0;">StockKeep Alert</h2>
          <p style="color: #6b7775; font-size: 14px; margin-top: 4px;">Low Stock Warning</p>
        </div>
        <div style="background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #eaeceb;">
          <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 16px; color: #191c1d;">${name}</p>
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #9aafaa;">SKU: ${sku}</p>
          <div style="display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-top: 1px solid #f0f1f2;">
            <span>Current Stock:</span>
            <strong style="color: ${quantity === 0 ? '#dc2626' : '#d97706'};">${quantity} units</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-top: 1px solid #f0f1f2;">
            <span>Threshold:</span>
            <strong>${threshold} units</strong>
          </div>
        </div>
        <p style="font-size: 12px; color: #6b7775; text-align: center; margin-top: 20px;">
          Please arrange to restock this item soon.
        </p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StockKeep Alerts <onboarding@resend.dev>',
        to: [recipient],
        subject: `⚠️ Low Stock Alert: ${name} (${quantity} left)`,
        html: htmlContent,
      }),
    });
  } catch (err) {
    console.error('Failed to send notification email:', err);
  }
}
