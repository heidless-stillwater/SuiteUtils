import '../server/services/config-env.js';
import TicketStore from '../server/services/TicketStore.js';

async function run() {
  console.log("Creating test ticket via TicketStore...");
  try {
    const ticket = await TicketStore.createTicket("AHYxlW1bIibW4LZl3LoHPbGUUaz2", {
      subject: "Test email template subject",
      description: "This is a test description to verify HTML formatting.",
      app: "SuiteUtils",
      function: "test-email-script",
      metadata: { debug: true, source: "test-script" }
    });
    console.log("SUCCESS! Ticket created:", ticket);
  } catch (err: any) {
    console.error("FAILED to create ticket:", err);
  }
}

run();
