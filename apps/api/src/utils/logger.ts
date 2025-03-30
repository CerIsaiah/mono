import { format } from 'util';

class Logger {
  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  }

  info(message: string, meta?: any) {
    // Force to stdout
    process.stdout.write(this.formatMessage('INFO', message, meta) + '\n');
  }

  error(message: string, meta?: any) {
    // Force to stderr
    process.stderr.write(this.formatMessage('ERROR', message, meta) + '\n');
  }

  warn(message: string, meta?: any) {
    // Force to stdout
    process.stdout.write(this.formatMessage('WARN', message, meta) + '\n');
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      process.stdout.write(this.formatMessage('DEBUG', message, meta) + '\n');
    }
  }
}

export const logger = new Logger(); 