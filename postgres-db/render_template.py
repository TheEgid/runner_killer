#!/usr/bin/env python3

import os
import sys
from jinja2 import Environment, FileSystemLoader, TemplateNotFound

def main():
    template_dir = '/'
    template_name = 'import.load.tpl'
    output_file = '/import.load'

    try:
        env = Environment(loader=FileSystemLoader(template_dir), autoescape=False)

        try:
            template = env.get_template(template_name)
        except TemplateNotFound:
            raise FileNotFoundError(f"Шаблон не найден: {template_name}")

        env_vars = dict(os.environ)
        rendered = template.render(env_vars)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(rendered)

        print(f"✅ Сгенерирован {output_file} из шаблона {template_name}")

    except Exception as e:
        print(f"❌ Ошибка при генерации шаблона: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
