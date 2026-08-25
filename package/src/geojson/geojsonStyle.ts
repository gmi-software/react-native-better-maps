function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function isHexDigit(value: string): boolean {
  return value.length === 1 && /[0-9A-Fa-f]/.test(value);
}

function expandShortChannel(channel: string | undefined): string | undefined {
  if (channel == null || !isHexDigit(channel)) {
    return undefined;
  }

  return `${channel}${channel}`.toUpperCase();
}

function rgbFromHexDigits(digits: string): string | undefined {
  switch (digits.length) {
    case 3:
    case 4: {
      const red = expandShortChannel(digits[0]);
      const green = expandShortChannel(digits[1]);
      const blue = expandShortChannel(digits[2]);
      if (red == null || green == null || blue == null) {
        return undefined;
      }

      return `${red}${green}${blue}`;
    }
    case 6:
    case 8: {
      const rgb = digits.slice(0, 6).toUpperCase();
      for (const character of rgb) {
        if (!isHexDigit(character)) {
          return undefined;
        }
      }

      return rgb;
    }
    default:
      return undefined;
  }
}

function applyHexOpacity(color: string, opacity: number): string {
  const trimmed = color.trim();
  const digits = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  const rgb = rgbFromHexDigits(digits);
  if (rgb == null) {
    return color;
  }

  const clamped = Math.min(1, Math.max(0, opacity));
  const alpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

  return `#${rgb}${alpha}`;
}

function readProperty(
  properties: Record<string, unknown> | null,
  key: string,
): unknown {
  if (properties == null) {
    return undefined;
  }

  return properties[key];
}

export function resolvePaintColor(
  properties: Record<string, unknown> | null,
  propertyName: string,
  fallback: string | undefined,
): string | undefined {
  const color = readProperty(properties, propertyName);
  const resolvedColor = isNonEmptyString(color) ? color : fallback;

  const opacity = asFiniteNumber(
    readProperty(properties, `${propertyName}-opacity`),
  );
  if (resolvedColor == null || opacity == null) {
    return resolvedColor;
  }

  return applyHexOpacity(resolvedColor, opacity);
}

export function resolveStrokeWidth(
  properties: Record<string, unknown> | null,
  fallback: number | undefined,
): number | undefined {
  const width = asFiniteNumber(readProperty(properties, 'stroke-width'));
  if (width == null) {
    return fallback;
  }

  return width;
}

export function resolveMarkerTitle(
  properties: Record<string, unknown> | null,
  fallback: string | undefined,
): string | undefined {
  const title = readProperty(properties, 'title');
  if (isNonEmptyString(title)) {
    return title;
  }

  const name = readProperty(properties, 'name');
  if (isNonEmptyString(name)) {
    return name;
  }

  return fallback;
}
