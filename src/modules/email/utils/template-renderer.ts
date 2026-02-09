import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export function renderTemplate(
  templateName: string,
  data: Record<string, any>,
): string {
  const templatePath = path.join(
    process.cwd(),
    'dist/modules/email/templates',
    templateName,
    `${templateName}.html`,
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found at: ${templatePath}`);
  }

  const templateStr = fs.readFileSync(templatePath, 'utf8');
  return Handlebars.compile(templateStr)(data);
}
