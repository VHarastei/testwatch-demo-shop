export type Category = 'notebooks' | 'writing' | 'navigation' | 'carry';

export interface Product {
  slug: string;
  name: string;
  priceCents: number;
  category: Category;
  blurb: string;
  /** Swatch colour for the drawn product card. */
  color: string;
  engravable?: boolean;
}

export const CATEGORY_NAMES: Record<Category, string> = {
  notebooks: 'Notebooks',
  writing: 'Writing',
  navigation: 'Navigation',
  carry: 'Carry',
};

export const PRODUCTS: Product[] = [
  { slug: 'field-notebook-3-pack', name: 'Field Notebook, 3-pack', priceCents: 1200, category: 'notebooks', color: '#C8A46E', blurb: '48 pages each, kraft cover, squared paper. Fits a back pocket.' },
  { slug: 'waterproof-notebook', name: 'Waterproof Notebook', priceCents: 1600, category: 'notebooks', color: '#E8C547', blurb: 'Synthetic paper that takes pencil in the rain. Lined, 64 pages.' },
  { slug: 'dot-grid-journal', name: 'Dot-Grid Journal A5', priceCents: 2400, category: 'notebooks', color: '#2F4B3F', blurb: 'Lay-flat binding, 160 numbered pages, two ribbon markers.' },
  { slug: 'graphite-pencils', name: 'Graphite Pencils, 12', priceCents: 900, category: 'writing', color: '#3E5C76', blurb: 'HB cedar pencils with erasers. Sharpened and ready.' },
  { slug: 'brass-sharpener', name: 'Brass Pencil Sharpener', priceCents: 1400, category: 'writing', color: '#B8893B', blurb: 'Solid brass, replaceable blade. Gets a patina with use.' },
  { slug: 'fine-liner-set', name: 'Fine-Liner Set, 4 colours', priceCents: 1100, category: 'writing', color: '#8E3B46', blurb: '0.4 mm archival ink in black, pine, rust and slate.' },
  { slug: 'engravable-pen', name: 'Engravable Aluminium Pen', priceCents: 2200, category: 'writing', color: '#7D8A86', blurb: 'Anodised barrel, refillable. Add an engraving image at checkout.', engravable: true },
  { slug: 'steel-pocket-ruler', name: 'Steel Pocket Ruler, 15 cm', priceCents: 700, category: 'navigation', color: '#9AA5A0', blurb: 'Etched metric and inch scales, map scale on the back.' },
  { slug: 'baseplate-compass', name: 'Baseplate Compass', priceCents: 3400, category: 'navigation', color: '#D2552B', blurb: 'Liquid-damped needle, declination adjustment, lanyard.' },
  { slug: 'folding-map-case', name: 'Folding Map Case', priceCents: 2900, category: 'navigation', color: '#45705A', blurb: 'Clear window, roll-top seal. Holds a folded 1:25k sheet.' },
  { slug: 'waxed-canvas-cover', name: 'Waxed Canvas Notebook Cover', priceCents: 3800, category: 'carry', color: '#6B5236', blurb: 'Holds two field notebooks, a pencil and a ruler.' },
  { slug: 'trail-labels', name: 'Weatherproof Trail Labels, 50', priceCents: 800, category: 'carry', color: '#F0A33A', blurb: 'Write-on tags with reinforced eyelets and ties.' },
];

export const SHIPPING_CENTS = 500;

export const bySlug = (slug: string): Product | undefined => PRODUCTS.find((p) => p.slug === slug);

export function search(query: string): Product[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return PRODUCTS.filter((p) => {
    const hay = `${p.name} ${p.blurb} ${CATEGORY_NAMES[p.category]}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
