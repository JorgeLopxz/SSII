const UNIT_MAP = {
    cm: ['cm', 'centimetro', 'centimetros'],
    m: ['m', 'metro', 'metros'],
    in: ['pulgada', 'pulgadas', 'inch', 'in'],
    kg: ['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'],
    lb: ['libra', 'libras', 'lb', 'lbs']
};

export const normalizeUnit = (unit) => {
    const value = unit.toLowerCase();

    for (const [normalized, aliases] of Object.entries(UNIT_MAP)) {
        if (aliases.includes(value)) {
            return normalized;
        }
    }

    return value;
};

export const convertUnits = (value, fromUnit, toUnit) => {
    if (fromUnit === 'cm' && toUnit === 'in') return value / 2.54;
    if (fromUnit === 'in' && toUnit === 'cm') return value * 2.54;
    if (fromUnit === 'm' && toUnit === 'cm') return value * 100;
    if (fromUnit === 'cm' && toUnit === 'm') return value / 100;
    if (fromUnit === 'm' && toUnit === 'in') return value * 39.3701;
    if (fromUnit === 'in' && toUnit === 'm') return value / 39.3701;
    if (fromUnit === 'kg' && toUnit === 'lb') return value * 2.20462;
    if (fromUnit === 'lb' && toUnit === 'kg') return value / 2.20462;
    return null;
};