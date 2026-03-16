import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export function renderTemplate(
  templateName: string,
  data: Record<string, any>,
): string {
  const baseDir = path.join(__dirname, '..', 'templates');
  const templatePath = path.join(baseDir, templateName, `${templateName}.html`);

  console.log(`📂 Template lookup | __dirname=${__dirname} | path=${templatePath}`);

  if (!fs.existsSync(templatePath)) {
    // Log what actually exists for debugging
    const baseDirExists = fs.existsSync(baseDir);
    console.error(`❌ Template not found | baseDir=${baseDir} | exists=${baseDirExists}`);
    if (baseDirExists) {
      const contents = fs.readdirSync(baseDir);
      console.error(`📁 Available templates: ${contents.join(', ')}`);
    }
    throw new Error(`Email template not found at: ${templatePath}`);
  }

  console.log(`✅ Template found, rendering...`);
  const templateStr = fs.readFileSync(templatePath, 'utf8');
  return Handlebars.compile(templateStr)(data);
}
