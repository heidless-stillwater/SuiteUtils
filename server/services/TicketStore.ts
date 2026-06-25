import { suiteDb } from './FirebaseAdmin.js';
import EmailService from './EmailService.js';

class TicketStore {
  /** Create a new ticket in Firestore and send email to support */
  async createTicket(userId: string, payload: any): Promise<any> {
    const ticketId = `ticket_${Date.now()}`;
    const ticket = {
      id: ticketId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'open',
      priority: payload.priority || 'medium',
      comments: [],
      resolvedAt: null,
      ...payload,
    };

    // Save to Firestore suiteDb
    await suiteDb.collection('tickets').doc(ticketId).set(ticket);

    // Send email notification to support team via EmailService
    const recipients = [
      process.env.SUPPORT_PRIMARY_EMAIL,
      process.env.SUPPORT_EMAIL_ALIASES
    ].filter(Boolean).join(', ');

    const ticketNum = ticket.id.split('_')[1] || 'New';
    const appTag = ticket.app || 'SuiteUtils';
    const dateString = new Date(ticket.createdAt).toLocaleString();
    
    const textBody = `==================================================
NEW SUPPORT TICKET SUBMITTED
==================================================

Ticket ID: ${ticket.id}
User ID: ${ticket.userId}
User Email: ${ticket.userEmail || 'N/A'}
Priority: ${ticket.priority.toUpperCase()}
Submitted At: ${dateString}
App Context: ${appTag}
Function/Context: ${ticket.function || 'N/A'}

--------------------------------------------------
DESCRIPTION
--------------------------------------------------
${ticket.description}

--------------------------------------------------
METADATA
--------------------------------------------------
${JSON.stringify(ticket.metadata, null, 2)}

==================================================
Stillwater Suite Support Portal`;

    const htmlBody = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
  <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-top: 0;">New Support Ticket</h2>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 6px 0; font-weight: bold; width: 120px;">Ticket ID:</td>
      <td style="padding: 6px 0;"><code>${ticket.id}</code></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">User ID:</td>
      <td style="padding: 6px 0;"><code>${ticket.userId}</code></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">User Email:</td>
      <td style="padding: 6px 0;"><code>${ticket.userEmail || 'N/A'}</code></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Priority:</td>
      <td style="padding: 6px 0;"><span style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">${ticket.priority}</span></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Submitted:</td>
      <td style="padding: 6px 0;">${dateString}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">App/Context:</td>
      <td style="padding: 6px 0;"><span style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${appTag}</span></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Function:</td>
      <td style="padding: 6px 0;"><code>${ticket.function || 'N/A'}</code></td>
    </tr>
  </table>
  
  <div style="background: #fafafa; padding: 15px; border-left: 4px solid #4f46e5; border-radius: 4px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #111827;">Description</h3>
    <p style="margin-bottom: 0; white-space: pre-wrap;">${ticket.description}</p>
  </div>
  
  ${Object.keys(ticket.metadata || {}).length > 0 ? `
  <div style="background: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 20px; font-family: monospace; font-size: 12px;">
    <h4 style="margin-top: 0; margin-bottom: 10px; color: #374151;">Metadata</h4>
    <pre style="margin: 0; white-space: pre-wrap;">${JSON.stringify(ticket.metadata, null, 2)}</pre>
  </div>
  ` : ''}
  
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
  <p style="font-size: 12px; color: #6b7280; text-align: center; margin-bottom: 0;">
    This is an automated notification from the Stillwater Suite Support Portal.
  </p>
</div>`;

    try {
      await EmailService.sendMail({
        from: process.env.SMTP_USER,
        to: recipients,
        subject: `[Support Ticket #${ticketNum}] [${ticket.priority.toUpperCase()}] ${ticket.subject || 'No Subject'}`,
        text: textBody,
        html: htmlBody,
      });
    } catch (emailErr: any) {
      console.error('[TicketStore] Email dispatch failed on creation:', emailErr.message);
    }

    return ticket;
  }

  /** Retrieve tickets for a given userId */
  async getTicketsByUser(userId: string): Promise<any[]> {
    try {
      const snapshot = await suiteDb.collection('tickets')
        .where('userId', '==', userId)
        .get();

      const tickets: any[] = [];
      snapshot.forEach(doc => {
        tickets.push(doc.data());
      });
      // Sort descending by createdAt in memory
      return tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err: any) {
      console.error('[TicketStore] getTicketsByUser error:', err.message);
      return [];
    }
  }

  /** Retrieve all tickets (Admin only) */
  async getAllTickets(): Promise<any[]> {
    try {
      const snapshot = await suiteDb.collection('tickets').get();
      const tickets: any[] = [];
      snapshot.forEach(doc => {
        tickets.push(doc.data());
      });
      // Sort descending by createdAt in memory
      return tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err: any) {
      console.error('[TicketStore] getAllTickets error:', err.message);
      return [];
    }
  }

  /** Update ticket status & optional priority/comments (Admin only) */
  async updateTicketStatus(
    ticketId: string,
    updatesPayload: { status?: string; priority?: string; comment?: string },
    adminUserId: string,
    adminEmail: string
  ): Promise<any> {
    const ticketRef = suiteDb.collection('tickets').doc(ticketId);
    const docSnap = await ticketRef.get();
    if (!docSnap.exists) {
      throw new Error('Ticket not found');
    }
    const ticket = docSnap.data();
    if (!ticket) throw new Error('Ticket empty');

    const now = new Date().toISOString();
    const updates: any = {
      updatedAt: now,
    };

    if (updatesPayload.status) {
      updates.status = updatesPayload.status;
      if (updatesPayload.status === 'resolved') {
        updates.resolvedAt = now;
      }
    }
    if (updatesPayload.priority) {
      updates.priority = updatesPayload.priority;
    }

    let addedComment = null;
    if (updatesPayload.comment && updatesPayload.comment.trim()) {
      addedComment = {
        id: `comment_${Date.now()}`,
        authorId: adminUserId,
        authorEmail: adminEmail,
        text: updatesPayload.comment,
        createdAt: now,
      };
      updates.comments = [...(ticket.comments || []), addedComment];
    }

    await ticketRef.update(updates);
    const updatedTicket = { ...ticket, ...updates };

    // Send notification update if status changed to in-progress or resolved (Option A)
    const statusChanged = updatesPayload.status && (updatesPayload.status !== ticket.status);
    const shouldNotify = statusChanged && (updatesPayload.status === 'in-progress' || updatesPayload.status === 'resolved');
    
    // Also notify if status is already in-progress/resolved but we just added a comment
    const justCommented = addedComment && (ticket.status === 'in-progress' || ticket.status === 'resolved');

    if (shouldNotify || justCommented) {
      try {
        await this.sendUserUpdateNotification(updatedTicket, addedComment);
      } catch (emailErr: any) {
        console.error('[TicketStore] Email dispatch failed on update:', emailErr.message);
      }
    }

    return updatedTicket;
  }

  /** Send status update/comment notification to user */
  async sendUserUpdateNotification(ticket: any, comment: any): Promise<void> {
    if (!ticket.userEmail) {
      console.warn(`[TicketStore] No userEmail found for ticket ${ticket.id}, skipping update notification.`);
      return;
    }

    const ticketNum = ticket.id.split('_')[1] || 'Update';
    const dateString = new Date(ticket.updatedAt).toLocaleString();
    const commentSection = comment ? `
--------------------------------------------------
SUPPORT TEAM COMMENT
--------------------------------------------------
${comment.text}
` : '';

    const textBody = `==================================================
TICKET STATUS UPDATE
==================================================

Ticket ID: ${ticket.id}
Status: ${ticket.status.toUpperCase()}
Updated At: ${dateString}

${commentSection}

You can track your ticket directly in the Stillwater Suite Support Portal.

==================================================
Stillwater Suite Support Portal`;

    const htmlBody = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
  <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-top: 0;">Ticket Status Update</h2>
  <p>Your support ticket has been updated to: <strong style="color: #4f46e5; text-transform: uppercase;">${ticket.status}</strong></p>
  
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 6px 0; font-weight: bold; width: 120px;">Ticket ID:</td>
      <td style="padding: 6px 0;"><code>${ticket.id}</code></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Status:</td>
      <td style="padding: 6px 0;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">${ticket.status}</span></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold;">Last Updated:</td>
      <td style="padding: 6px 0;">${dateString}</td>
    </tr>
  </table>
  
  ${comment ? `
  <div style="background: #fafafa; padding: 15px; border-left: 4px solid #4f46e5; border-radius: 4px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #111827;">Support Team Response</h3>
    <p style="margin-bottom: 0; white-space: pre-wrap;">${comment.text}</p>
  </div>
  ` : ''}
  
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
  <p style="font-size: 12px; color: #6b7280; text-align: center; margin-bottom: 0;">
    This is an automated notification from the Stillwater Suite Support Portal.
  </p>
</div>`;

    await EmailService.sendMail({
      from: process.env.SMTP_USER,
      to: ticket.userEmail,
      subject: `[Support Ticket #${ticketNum}] Status Update: ${ticket.status.toUpperCase()}`,
      text: textBody,
      html: htmlBody,
    });
  }
}

const ticketStoreInstance = new TicketStore();
export default ticketStoreInstance;
