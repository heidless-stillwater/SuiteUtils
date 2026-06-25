import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

/**
 * EmailService – singleton that either sends real email via nodemailer
 * or falls back to writing the email payload to a JSON log file.
 */
class EmailService {
  private static instance: EmailService;
  private transporter?: nodemailer.Transporter;
  private fallbackLogPath: string;

  private constructor() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    this.fallbackLogPath = path.join(process.cwd(), 'logs', 'email_inbox.json');
    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
    } else {
      console.warn('[EmailService] SMTP env vars missing – falling back to JSON log');
    }
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send an email. If the transporter is configured it uses nodemailer,
   * otherwise it appends the payload to the fallback JSON log.
   */
  async sendMail(options: nodemailer.SendMailOptions): Promise<void> {
    if (this.transporter) {
      await this.transporter.sendMail(options);
    } else {
      // Ensure the logs directory exists
      const dir = path.dirname(this.fallbackLogPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const entry = { timestamp: new Date().toISOString(), ...options };
      let current: any[] = [];
      if (fs.existsSync(this.fallbackLogPath)) {
        try {
          const raw = fs.readFileSync(this.fallbackLogPath, 'utf8');
          current = JSON.parse(raw);
        } catch {
          current = [];
        }
      }
      current.push(entry);
      fs.writeFileSync(this.fallbackLogPath, JSON.stringify(current, null, 2), 'utf8');
    }
  }
}

export default EmailService.getInstance();
