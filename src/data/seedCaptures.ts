/**
 * src/data/seedCaptures.ts
 *
 * Pre-seeded editorial photography, curated collections, photographer statement,
 * and interactive Gear & Optics Inventory for captures-gallery.
 */

import type { Capture, Collection, GearItem } from '../types/gallery';

export const SEED_COLLECTIONS: Collection[] = [
  {
    id: 'col-architecture',
    slug: 'architecture',
    title: 'Architectural geometry',
    description:
      'Studies in poured concrete, cantilevered forms, and directional daylight across modern urban structures.',
    cover_capture_id: 'cap-brutalist-atrium-01',
    sort_order: 1,
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'col-street',
    slug: 'street',
    title: 'Nocturnal street & transit',
    description:
      'Fleeting human silhouettes, neon reflections on wet asphalt, and quiet solitude inside dense metropolitan corridors.',
    cover_capture_id: 'cap-shibuya-rain-reflections',
    sort_order: 2,
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'col-minimalism',
    slug: 'minimalism',
    title: 'Atmospheric minimalism',
    description:
      'Negative space, coastal fog, and quiet horizon lines captured with long exposures and medium-format optics.',
    cover_capture_id: 'cap-mist-over-lake-biwa',
    sort_order: 3,
    created_at: '2026-01-25T10:00:00Z',
  },
];

export const SEED_CAPTURES: Capture[] = [
  {
    id: 'cap-brutalist-atrium-01',
    slug: 'brutalist-atrium-01',
    title: 'Brutalist concrete atrium',
    story:
      'High-angle afternoon sunlight slices across board-formed concrete ribs inside London’s Barbican estate, turning raw structural mass into a study of rhythmic shadow.',
    collection_slug: 'architecture',
    r2_key: 'captures/architecture/brutalist-atrium-01.jpg',
    image_url:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=85',
    width: 3840,
    height: 2560,
    aspect_ratio: 1.5,
    location: 'Barbican Estate, London',
    captured_at: '2026-02-14T11:30:00Z',
    camera_model: 'Leica Q2',
    lens_model: 'Summilux 28mm f/1.7 ASPH',
    focal_length: '28mm',
    aperture: 'f/2.8',
    shutter_speed: '1/250s',
    iso: 100,
    tags: ['brutalism', 'concrete', 'monochrome', 'geometry', 'london'],
    featured: true,
    created_at: '2026-02-15T09:00:00Z',
  },
  {
    id: 'cap-shibuya-rain-reflections',
    slug: 'shibuya-rain-reflections',
    title: 'Shibuya rain reflections',
    story:
      'Just after midnight in Dogenzaka, a passing taxi scatters amber and cyan signage across fresh rain puddles while a lone commuter waits at the crosswalk.',
    collection_slug: 'street',
    r2_key: 'captures/street/shibuya-rain-reflections.jpg',
    image_url:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=85',
    width: 3840,
    height: 2560,
    aspect_ratio: 1.5,
    location: 'Shibuya, Tokyo',
    captured_at: '2026-03-01T21:15:00Z',
    camera_model: 'Fujifilm X-T5',
    lens_model: 'Fujinon XF 33mm f/1.4 R LM WR',
    focal_length: '33mm',
    aperture: 'f/1.4',
    shutter_speed: '1/500s',
    iso: 800,
    tags: ['tokyo', 'rain', 'neon', 'night', 'reflections'],
    featured: true,
    created_at: '2026-03-02T08:30:00Z',
  },
  {
    id: 'cap-mist-over-lake-biwa',
    slug: 'mist-over-lake-biwa',
    title: 'Mist over Lake Biwa',
    story:
      'A quarter-second exposure before dawn softens the water surface into pale silk, leaving the distant torii gate suspended between water and winter mist.',
    collection_slug: 'minimalism',
    r2_key: 'captures/minimalism/mist-over-lake-biwa.jpg',
    image_url:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=85',
    width: 3840,
    height: 2160,
    aspect_ratio: 1.78,
    location: 'Shiga Prefecture, Japan',
    captured_at: '2026-03-10T06:10:00Z',
    camera_model: 'Hasselblad 907X 50C',
    lens_model: 'XCD 45mm f/4 P',
    focal_length: '45mm',
    aperture: 'f/8',
    shutter_speed: '1/4s',
    iso: 100,
    tags: ['mist', 'water', 'long-exposure', 'japan', 'calm'],
    featured: true,
    created_at: '2026-03-11T07:45:00Z',
  },
  {
    id: 'cap-spiral-concrete-stairs',
    slug: 'spiral-concrete-stairs',
    title: 'Spiral concrete stairwell',
    story:
      'Looking directly upward through a cylindrical museum stairwell in Zurich, where diffused skylight traces a continuous Fibonacci curve from landing to landing.',
    collection_slug: 'architecture',
    r2_key: 'captures/architecture/spiral-concrete-stairs.jpg',
    image_url:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    width: 2560,
    height: 3840,
    aspect_ratio: 0.67,
    location: 'Kunsthaus, Zurich',
    captured_at: '2026-02-18T15:45:00Z',
    camera_model: 'Sony A7R V',
    lens_model: 'FE 24-70mm f/2.8 GM II',
    focal_length: '24mm',
    aperture: 'f/8',
    shutter_speed: '1/60s',
    iso: 200,
    tags: ['staircase', 'spiral', 'zurich', 'symmetry', 'concrete'],
    featured: false,
    created_at: '2026-02-19T12:15:00Z',
  },
  {
    id: 'cap-night-market-neon',
    slug: 'night-market-neon',
    title: 'Night market steam & neon',
    story:
      'Warm steam rising from street stalls catches the glow of hand-bent glass tubes in Taipei, framed in a square 1:1 crop that isolates gesture and texture.',
    collection_slug: 'street',
    r2_key: 'captures/street/night-market-neon.jpg',
    image_url:
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1400&q=85',
    width: 3000,
    height: 3000,
    aspect_ratio: 1.0,
    location: 'Raohe Street, Taipei',
    captured_at: '2026-03-05T22:40:00Z',
    camera_model: 'Leica Q2',
    lens_model: 'Summilux 28mm f/1.7 ASPH',
    focal_length: '28mm',
    aperture: 'f/2',
    shutter_speed: '1/125s',
    iso: 1600,
    tags: ['taipei', 'market', 'neon', 'street-food', 'square'],
    featured: true,
    created_at: '2026-03-06T10:20:00Z',
  },
  {
    id: 'cap-solitary-pine-ridge',
    slug: 'solitary-pine-ridge',
    title: 'Solitary pine on basalt ridge',
    story:
      'A single wind-sculpted black pine clings to a volcanic ridge as sea fog rolls inland, compressed at 55mm to emphasize vertical poise against empty sky.',
    collection_slug: 'minimalism',
    r2_key: 'captures/minimalism/solitary-pine-ridge.jpg',
    image_url:
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=85',
    width: 2560,
    height: 3840,
    aspect_ratio: 0.67,
    location: 'Izu Peninsula, Japan',
    captured_at: '2026-03-12T09:20:00Z',
    camera_model: 'Fujifilm X-T5',
    lens_model: 'Fujinon XF 16-55mm f/2.8 R LM WR',
    focal_length: '55mm',
    aperture: 'f/5.6',
    shutter_speed: '1/1000s',
    iso: 125,
    tags: ['pine', 'ridge', 'fog', 'minimal', 'portrait'],
    featured: false,
    created_at: '2026-03-13T11:00:00Z',
  },
  {
    id: 'cap-nordic-glass-pavilion',
    slug: 'nordic-glass-pavilion',
    title: 'Nordic glass & timber pavilion',
    story:
      'Low-angle winter sun reflects off structural low-iron glass panels along the Oslo fjord, balancing cold exterior steel with warm interior oak louvers.',
    collection_slug: 'architecture',
    r2_key: 'captures/architecture/nordic-glass-pavilion.jpg',
    image_url:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=85',
    width: 3840,
    height: 2560,
    aspect_ratio: 1.5,
    location: 'Bjørvika, Oslo',
    captured_at: '2026-01-29T13:10:00Z',
    camera_model: 'Sony A7R V',
    lens_model: 'FE 24-70mm f/2.8 GM II',
    focal_length: '35mm',
    aperture: 'f/8',
    shutter_speed: '1/320s',
    iso: 100,
    tags: ['oslo', 'glass', 'facade', 'nordic', 'daylight'],
    featured: false,
    created_at: '2026-01-30T14:00:00Z',
  },
  {
    id: 'cap-white-sands-horizon',
    slug: 'white-sands-horizon',
    title: 'Gypsum dune shadow line',
    story:
      'At twilight, the last five minutes of direct sun divide the gypsum dunes into two pure tonal fields—warm alabaster and cool cobalt shadow.',
    collection_slug: 'minimalism',
    r2_key: 'captures/minimalism/white-sands-horizon.jpg',
    image_url:
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1600&q=85',
    width: 3840,
    height: 2560,
    aspect_ratio: 1.5,
    location: 'White Sands, New Mexico',
    captured_at: '2026-02-08T17:50:00Z',
    camera_model: 'Hasselblad 907X 50C',
    lens_model: 'XCD 45mm f/4 P',
    focal_length: '45mm',
    aperture: 'f/11',
    shutter_speed: '1/125s',
    iso: 100,
    tags: ['desert', 'dunes', 'horizon', 'shadow', 'minimal'],
    featured: true,
    created_at: '2026-02-09T09:15:00Z',
  },
];

export const SEED_GEAR_INVENTORY: GearItem[] = [
  {
    id: 'gear-leica-q2',
    name: 'Leica Q2',
    type: 'camera',
    brand: 'Leica',
    sensor_or_mount: '47.3MP Full-Frame CMOS (Fixed Lens)',
    specs: '28mm f/1.7 Summilux ASPH • IP52 Weather Sealed • 3.68MP OLED EVF',
    capture_count: 2,
    description:
      'Primary everyday carry for architectural documentation and wet-weather nocturnal street photography.',
  },
  {
    id: 'gear-fujifilm-xt5',
    name: 'Fujifilm X-T5',
    type: 'camera',
    brand: 'Fujifilm',
    sensor_or_mount: '40.2MP APS-C X-Trans CMOS 5 HR (X-Mount)',
    specs: '7-Stop IBIS • Tactile Triple-Dial Controls • 1/180,000s Electronic Shutter',
    capture_count: 2,
    description:
      'Compact high-resolution body paired with fast prime optics for fast-moving transit corridors and coastal travel.',
  },
  {
    id: 'gear-sony-a7rv',
    name: 'Sony A7R V',
    type: 'camera',
    brand: 'Sony',
    sensor_or_mount: '61.0MP Full-Frame Exmor R BSI (E-Mount)',
    specs: '8-Stop IBIS • 4-Axis Multi-Angle LCD • 15-Stop Dynamic Range',
    capture_count: 2,
    description:
      'High-resolution architectural workhorse used when resolving fine structural tolerances and wide rectilinear perspectives.',
  },
  {
    id: 'gear-hasselblad-907x',
    name: 'Hasselblad 907X 50C',
    type: 'camera',
    brand: 'Hasselblad',
    sensor_or_mount: '50MP Medium Format CMOS (43.8 × 32.9mm)',
    specs: '16-Bit Color Depth • Hassleblad Natural Color Solution • Leaf Shutter Sync',
    capture_count: 2,
    description:
      'Modular medium-format digital back dedicated to slow, deliberate minimalist landscapes on a tripod.',
  },
  {
    id: 'gear-lens-summilux-28',
    name: 'Summilux 28mm f/1.7 ASPH',
    type: 'lens',
    brand: 'Leica',
    sensor_or_mount: 'Integrated Full-Frame Prime',
    specs: '11 Elements in 9 Groups • 3 Aspherical Surfaces • Optical Image Stabilization',
    capture_count: 2,
    description:
      'Micro-contrast and edge-to-edge sharpness even wide open at f/1.7 under low ambient street lighting.',
  },
  {
    id: 'gear-lens-xf33',
    name: 'Fujinon XF 33mm f/1.4 R LM WR',
    type: 'lens',
    brand: 'Fujifilm',
    sensor_or_mount: 'Fujifilm X-Mount (50mm full-frame equiv.)',
    specs: 'Linear AF Motor • Weather-Resistant 15 Elements • 9-Blade Rounded Aperture',
    capture_count: 1,
    description:
      'Natural standard field of view with smooth highlight roll-off on rain-slicked surfaces.',
  },
  {
    id: 'gear-lens-fe2470',
    name: 'FE 24-70mm f/2.8 GM II',
    type: 'lens',
    brand: 'Sony',
    sensor_or_mount: 'Sony E-Mount Full-Frame',
    specs: '20 Elements in 15 Groups • Nano AR Coating II • 695g Lightweight Barrel',
    capture_count: 2,
    description:
      'Versatile rectilinear zoom for framing tight interior stairwells and wide architectural exteriors.',
  },
  {
    id: 'gear-lens-xcd45',
    name: 'XCD 45mm f/4 P',
    type: 'lens',
    brand: 'Hasselblad',
    sensor_or_mount: 'Hasselblad X-Mount (35mm full-frame equiv.)',
    specs: 'Integrated Central Leaf Shutter (up to 1/2000s) • 2 Aspherical Elements',
    capture_count: 2,
    description:
      'Vibration-free leaf shutter optics ideal for quarter-second exposures at dawn.',
  },
];

export const PHOTOGRAPHER_BIO = {
  name: 'Sora Takahashi',
  role: 'Architectural & Visual Photographer',
  location: 'Tokyo & London',
  statementTitle: 'Light, structure, and quiet intervals',
  statementParagraphs: [
    'My work explores the quiet tension between permanence and transience—how poured concrete and steel frame the fleeting movement of rain, fog, and solitary commuters.',
    'Every photograph in this archive is presented with its complete optical and exposure telemetry. Whether working handheld at midnight with a fast 28mm prime or waiting before dawn with a medium-format leaf shutter, technical restraint is always in service of visual stillness.',
  ],
  principles: [
    {
      title: 'Unmanipulated geometry',
      description:
        'Captures preserve authentic optical perspective and natural directional light without composite manipulation.',
    },
    {
      title: 'Full EXIF transparency',
      description:
        'Every frame records camera body, glass, focal length, aperture, shutter duration, and ISO sensitivity.',
    },
    {
      title: 'Edge-delivered archive',
      description:
        'Originals and WebP derivatives are stored on Cloudflare R2 and indexed in Cloudflare D1 for sub-second global inspection.',
    },
  ],
};
