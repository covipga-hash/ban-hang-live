export const APP_NAME = 'Host bán hàng';
export const HOST_NAME = 'Host bán hàng';
export const HOST_CHARACTER_NAME = 'Ngọc';

export const CATEGORIES = [
  'Thời trang',
  'Mỹ phẩm',
  'Đồ ăn',
  'Gia dụng',
  'Vải & Phụ kiện',
];

export const INITIAL_PRODUCTS = [
  // Thời trang
  {
    id: 'ao-trang-tay-phong',
    name: 'Áo trắng tay phồng',
    aliases: ['áo trắng tay phồng', 'áo trắng', 'áo tay phồng', 'áo phồng'],
    category: 'Thời trang',
    price: 189000,
    originalPrice: 259000,
    discountPercent: 27,
    stock: 25,
    benefit: 'Mát nhẹ, mặc đi chơi hay đi học đều xinh',
    colors: ['trắng tinh', 'trắng kem'],
    sizes: ['S', 'M', 'L'],
    material: 'Cotton lụa thoáng mát, mềm nhẹ',
    variants: 'Có màu trắng tinh và trắng kem, đủ size S, M, L nha',
    accent: '#f472b6',
    bgTint: '#fff1f5',
  },
  {
    id: 'quan-short-jeans-xanh',
    name: 'Quần short jeans xanh',
    aliases: ['quần short jeans xanh', 'quần short jeans', 'quần short', 'quần jeans', 'short jeans', 'quần jean'],
    category: 'Thời trang',
    price: 229000,
    originalPrice: 299000,
    discountPercent: 23,
    stock: 20,
    benefit: 'Co giãn nhẹ, tôn dáng, dễ phối đồ',
    colors: ['xanh nhạt', 'xanh đậm'],
    sizes: ['S', 'M', 'L', 'XL'],
    material: 'Denim cotton co giãn nhẹ, đứng form',
    variants: 'Có xanh nhạt và xanh đậm, đủ size S, M, L, XL nè',
    accent: '#3b82f6',
    bgTint: '#eff6ff',
  },
  {
    id: 'vay-hoa',
    name: 'Váy hoa',
    aliases: ['váy hoa', 'đầm hoa', 'váy'],
    category: 'Thời trang',
    price: 279000,
    originalPrice: 359000,
    discountPercent: 22,
    stock: 15,
    benefit: 'Nhẹ bay, mặc hè mát và nữ tính',
    colors: ['hoa nhí vàng', 'hoa nhí xanh pastel'],
    sizes: ['S', 'M', 'L'],
    material: 'Voan hoa mềm nhẹ có lớp lót thoáng mát',
    variants: 'Có hoa nhí vàng và hoa nhí xanh pastel, đủ size S, M, L',
    accent: '#fb7185',
    bgTint: '#fff1f2',
  },

  // Mỹ phẩm
  {
    id: 'son',
    name: 'Son',
    aliases: ['son lì', 'son môi', 'thỏi son', 'son'],
    category: 'Mỹ phẩm',
    price: 149000,
    originalPrice: 199000,
    discountPercent: 25,
    stock: 30,
    benefit: 'Màu tươi, lì nhẹ, không khô môi',
    colors: ['đỏ đất', 'cam cháy', 'hồng san hô'],
    sizes: null,
    material: 'Chất son lì mịn có dưỡng, không gây khô môi',
    variants: 'Có 3 màu hot: đỏ đất, cam cháy và hồng san hô nha',
    accent: '#e11d48',
    bgTint: '#fff1f2',
  },
  {
    id: 'kem-duong',
    name: 'Kem dưỡng',
    aliases: ['kem dưỡng ẩm', 'kem dưỡng da', 'kem dưỡng'],
    category: 'Mỹ phẩm',
    price: 199000,
    originalPrice: 269000,
    discountPercent: 26,
    stock: 18,
    benefit: 'Dưỡng ẩm, da mềm mịn sau 1 tuần',
    colors: ['hũ 50ml'],
    sizes: null,
    material: 'Kết cấu kem mỏng nhẹ thấm nhanh, cấp ẩm dịu nhẹ',
    variants: 'Có bản hũ 50ml dưỡng ẩm ngày đêm, dịu nhẹ cho mọi loại da',
    accent: '#f59e0b',
    bgTint: '#fffbeb',
  },
  {
    id: 'sua-rua-mat',
    name: 'Sữa rửa mặt',
    aliases: ['sữa rửa mặt', 'rửa mặt', 'srm'],
    category: 'Mỹ phẩm',
    price: 129000,
    originalPrice: 169000,
    discountPercent: 24,
    stock: 22,
    benefit: 'Sạch sâu, dịu nhẹ cho da nhạy cảm',
    colors: ['hoa cúc dịu nhẹ', 'trà xanh kiềm dầu'],
    sizes: null,
    material: 'Gel tạo bọt mịn pH 5.5 dịu nhẹ cho da nhạy cảm',
    variants: 'Tuýp 120ml có bản dịu nhẹ hoa cúc và bản trà xanh kiềm dầu',
    accent: '#14b8a6',
    bgTint: '#f0fdfa',
  },

  // Đồ ăn
  {
    id: 'ca-phe-da',
    name: 'Cà phê đá',
    aliases: ['cà phê đá', 'cà phê sữa', 'cà phê', 'cafe đá', 'cafe'],
    category: 'Đồ ăn',
    price: 39000,
    originalPrice: 49000,
    discountPercent: 20,
    stock: 40,
    benefit: 'Đậm vị, tỉnh táo cả buổi',
    colors: ['cà phê sữa đá', 'đen đá', 'bạc xỉu'],
    sizes: null,
    material: 'Cà phê rang mộc đậm đà pha phin truyền thống',
    variants: 'Có cà phê sữa đá, đen đá và bạc xỉu, chọn ít ngọt hoặc vừa',
    accent: '#92400e',
    bgTint: '#fef3c7',
  },
  {
    id: 'banh',
    name: 'Bánh',
    aliases: ['bánh ngọt', 'bánh bông lan', 'bánh ăn vặt', 'bánh'],
    category: 'Đồ ăn',
    price: 59000,
    originalPrice: 79000,
    discountPercent: 25,
    stock: 30,
    benefit: 'Thơm mềm, ăn vặt đúng điệu',
    colors: ['bơ sữa', 'socola', 'trà xanh'],
    sizes: null,
    material: 'Bánh tươi nướng mềm thơm bơ sữa mỗi ngày',
    variants: 'Có vị bơ sữa, socola và trà xanh thơm béo nha',
    accent: '#d97706',
    bgTint: '#fffbeb',
  },
  {
    id: 'snack',
    name: 'Snack',
    aliases: ['snack giòn', 'bim bim', 'snack'],
    category: 'Đồ ăn',
    price: 35000,
    originalPrice: 45000,
    discountPercent: 22,
    stock: 50,
    benefit: 'Giòn rụm, ăn là ghiền',
    colors: ['phô mai', 'rong biển', 'cay nhẹ'],
    sizes: null,
    material: 'Khoai tây và bắp sấy giòn rụm ít dầu',
    variants: 'Có vị phô mai, rong biển và cay nhẹ cực bắt miệng',
    accent: '#ea580c',
    bgTint: '#fff7ed',
  },

  // Gia dụng
  {
    id: 'ly-giu-nhiet',
    name: 'Ly giữ nhiệt',
    aliases: ['ly giữ nhiệt', 'bình giữ nhiệt', 'cốc giữ nhiệt'],
    category: 'Gia dụng',
    price: 159000,
    originalPrice: 219000,
    discountPercent: 27,
    stock: 12,
    benefit: 'Giữ đá 8 tiếng, không đọng nước',
    colors: ['trắng kem', 'hồng phấn', 'xanh mint'],
    sizes: null,
    material: 'Inox 304 hai lớp cách nhiệt chân không, dung tích 600ml',
    variants: 'Có màu trắng kem, hồng phấn và xanh mint, dung tích 600ml',
    accent: '#0ea5e9',
    bgTint: '#f0f9ff',
  },
  {
    id: 'tui-coi',
    name: 'Túi cói',
    aliases: ['túi cói', 'giỏ cói', 'túi đi biển'],
    category: 'Gia dụng',
    price: 139000,
    originalPrice: 189000,
    discountPercent: 26,
    stock: 10,
    benefit: 'Nhẹ, bền, đi biển hay đi chợ đều hợp',
    colors: ['cói tự nhiên nơ trắng', 'cói tự nhiên quai nâu'],
    sizes: null,
    material: 'Sợi cói tự nhiên đan chắc tay, nhẹ và bền',
    variants: 'Có mẫu nơ trắng và mẫu quai nâu tự nhiên cực xinh',
    accent: '#b45309',
    bgTint: '#fefce8',
  },

  // Vải & Phụ kiện
  {
    id: 'vai-hoa',
    name: 'Vải hoa',
    aliases: ['vải hoa', 'vải may váy', 'vải may áo', 'vải'],
    category: 'Vải & Phụ kiện',
    price: 89000,
    originalPrice: 119000,
    discountPercent: 25,
    stock: 20,
    benefit: 'Mềm mát, may váy hay may áo đều đẹp',
    colors: ['hoa nhí nền kem', 'hoa xanh pastel'],
    sizes: null,
    material: 'Vải lụa cotton mềm mát, khổ rộng 1m5',
    variants: 'Có họa tiết hoa nhí nền kem và hoa xanh pastel, khổ 1m5',
    accent: '#ec4899',
    bgTint: '#fdf2f8',
  },
  {
    id: 'khan',
    name: 'Khăn',
    aliases: ['khăn bông', 'khăn mặt', 'khăn tắm', 'khăn'],
    category: 'Vải & Phụ kiện',
    price: 79000,
    originalPrice: 99000,
    discountPercent: 20,
    stock: 25,
    benefit: 'Mềm êm, thấm hút tốt',
    colors: ['trắng sữa', 'be ấm', 'xanh pastel', 'hồng phấn'],
    sizes: null,
    material: 'Cotton sợi tự nhiên mềm êm, thấm hút nước tốt',
    variants: 'Có màu trắng sữa, be ấm, xanh pastel và hồng phấn nha',
    accent: '#6366f1',
    bgTint: '#eef2ff',
  },
].map((product, index) => {
  const codeNumber = index + 1;
  const code = String(codeNumber).padStart(2, '0');
  return {
    ...product,
    codeNumber,
    code,
    codeLabel: `Mã ${code}`,
  };
});

export function formatVnd(amount) {
  const rounded = Math.max(0, Math.round(Number(amount) || 0));
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
}

export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(s / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Custom vector SVG illustration for every product (zero real photos).
 */
export function renderProductSvg(productId, size = 180) {
  const s = `width="${size}" height="${size}" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg"`;
  switch (productId) {
    case 'ao-trang-tay-phong':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FFE4EC"/>
        <ellipse cx="38" cy="70" rx="22" ry="20" fill="#FFFFFF" stroke="#E2D5DA" stroke-width="3"/>
        <ellipse cx="122" cy="70" rx="22" ry="20" fill="#FFFFFF" stroke="#E2D5DA" stroke-width="3"/>
        <path d="M52 50 C60 64, 100 64, 108 50 L114 126 C95 132, 65 132, 46 126 Z" fill="#FFFFFF" stroke="#E2D5DA" stroke-width="3"/>
        <path d="M62 50 C70 66, 90 66, 98 50" stroke="#F472B6" stroke-width="3" stroke-linecap="round"/>
        <circle cx="80" cy="76" r="3" fill="#F9A8D4"/>
        <circle cx="80" cy="92" r="3" fill="#F9A8D4"/>
        <circle cx="80" cy="108" r="3" fill="#F9A8D4"/>
        <path d="M26 78 C32 84, 44 84, 48 78" stroke="#FBCFE8" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M112 78 C116 84, 128 84, 134 78" stroke="#FBCFE8" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;

    case 'quan-short-jeans-xanh':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#DBEAFE"/>
        <path d="M40 44 H120 L128 118 L88 122 L80 94 L72 122 L32 118 Z" fill="#3B82F6" stroke="#1D4ED8" stroke-width="3" stroke-linejoin="round"/>
        <rect x="40" y="44" width="80" height="14" rx="3" fill="#2563EB" stroke="#1D4ED8" stroke-width="2.5"/>
        <circle cx="80" cy="51" r="3.5" fill="#FDE047"/>
        <path d="M48 64 C52 76, 62 78, 68 74" stroke="#93C5FD" stroke-width="2.5" stroke-dasharray="4 3" stroke-linecap="round"/>
        <path d="M112 64 C108 76, 98 78, 92 74" stroke="#93C5FD" stroke-width="2.5" stroke-dasharray="4 3" stroke-linecap="round"/>
        <line x1="80" y1="58" x2="80" y2="92" stroke="#93C5FD" stroke-width="2" stroke-dasharray="4 3"/>
      </svg>`;

    case 'vay-hoa':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FFE4E6"/>
        <path d="M64 36 L68 58 H92 L96 36" stroke="#FB7185" stroke-width="4" stroke-linecap="round"/>
        <path d="M58 56 H102 L126 128 C98 138, 62 138, 34 128 Z" fill="#FFF5F7" stroke="#FB7185" stroke-width="3" stroke-linejoin="round"/>
        <rect x="55" y="74" width="50" height="7" rx="3.5" fill="#FDA4AF"/>
        <circle cx="64" cy="98" r="5" fill="#FB7185"/>
        <circle cx="64" cy="98" r="2" fill="#FEF08A"/>
        <circle cx="94" cy="104" r="5.5" fill="#F472B6"/>
        <circle cx="94" cy="104" r="2" fill="#FEF08A"/>
        <circle cx="78" cy="118" r="5" fill="#FB7185"/>
        <circle cx="78" cy="118" r="2" fill="#FEF08A"/>
        <circle cx="52" cy="116" r="4" fill="#F472B6"/>
        <circle cx="106" cy="118" r="4.5" fill="#FB7185"/>
      </svg>`;

    case 'son':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FFE4E6"/>
        <rect x="58" y="84" width="44" height="48" rx="8" fill="#1F2937"/>
        <rect x="64" y="64" width="32" height="24" rx="4" fill="#F59E0B"/>
        <rect x="64" y="64" width="10" height="24" rx="3" fill="#FCD34D" opacity="0.6"/>
        <path d="M68 64 V38 C68 28, 92 24, 92 42 V64 Z" fill="#E11D48"/>
        <path d="M72 37 C76 31, 86 30, 88 38" stroke="#FDA4AF" stroke-width="3" stroke-linecap="round"/>
        <rect x="64" y="94" width="32" height="5" rx="2.5" fill="#F59E0B"/>
      </svg>`;

    case 'kem-duong':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FEF3C7"/>
        <rect x="42" y="72" width="76" height="54" rx="16" fill="#FFFFFF" stroke="#F59E0B" stroke-width="3"/>
        <rect x="48" y="54" width="64" height="20" rx="8" fill="#FBBF24" stroke="#D97706" stroke-width="2.5"/>
        <rect x="54" y="88" width="52" height="22" rx="6" fill="#FEF3C7"/>
        <circle cx="80" cy="99" r="6" fill="#F59E0B"/>
        <path d="M60 44 C66 36, 76 36, 80 42 C84 36, 94 36, 100 44" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
      </svg>`;

    case 'sua-rua-mat':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#CCFBF1"/>
        <path d="M54 34 H106 L98 112 H62 Z" fill="#FFFFFF" stroke="#0D9488" stroke-width="3" stroke-linejoin="round"/>
        <rect x="65" y="112" width="30" height="18" rx="4" fill="#14B8A6"/>
        <circle cx="80" cy="68" r="14" fill="#99F6E4"/>
        <path d="M80 58 C86 66, 86 74, 80 76 C74 74, 74 66, 80 58 Z" fill="#0D9488"/>
        <circle cx="116" cy="52" r="6" fill="#5EEAD4" opacity="0.7"/>
        <circle cx="44" cy="62" r="5" fill="#5EEAD4" opacity="0.7"/>
      </svg>`;

    case 'ca-phe-da':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FEF3C7"/>
        <line x1="88" y1="22" x2="82" y2="54" stroke="#10B981" stroke-width="6" stroke-linecap="round"/>
        <path d="M50 54 H110 L102 128 C101 132, 96 134, 80 134 C64 134, 59 132, 58 128 Z" fill="#FFF7ED" stroke="#92400E" stroke-width="3"/>
        <path d="M54 72 H106 L101 126 H59 Z" fill="#92400E"/>
        <path d="M55 82 C68 88, 92 76, 105 84 L101 126 H59 Z" fill="#B45309"/>
        <rect x="62" y="64" width="14" height="14" rx="3" fill="#FFFFFF" opacity="0.8" transform="rotate(-10 62 64)"/>
        <rect x="84" y="62" width="14" height="14" rx="3" fill="#FFFFFF" opacity="0.8" transform="rotate(12 84 62)"/>
        <rect x="46" y="48" width="68" height="10" rx="5" fill="#FDE68A" stroke="#92400E" stroke-width="2.5"/>
      </svg>`;

    case 'banh':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FEF3C7"/>
        <rect x="38" y="82" width="84" height="40" rx="12" fill="#FDE68A" stroke="#D97706" stroke-width="3"/>
        <path d="M38 92 C48 104, 60 88, 72 98 C84 108, 96 88, 108 98 C114 102, 118 96, 122 92 V82 C122 72, 112 66, 80 66 C48 66, 38 72, 38 82 Z" fill="#FFF1F2" stroke="#FB7185" stroke-width="3"/>
        <circle cx="80" cy="54" r="12" fill="#E11D48"/>
        <path d="M80 42 C84 34, 92 34, 96 38" stroke="#16A34A" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="58" cy="108" r="3" fill="#D97706"/>
        <circle cx="80" cy="110" r="3" fill="#D97706"/>
        <circle cx="102" cy="108" r="3" fill="#D97706"/>
      </svg>`;

    case 'snack':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FFEDD5"/>
        <path d="M46 38 L54 44 L62 38 L70 44 L78 38 L86 44 L94 38 L102 44 L114 38 L112 126 L102 120 L94 126 L86 120 L78 126 L70 120 L62 126 L54 120 L46 126 Z" fill="#F97316" stroke="#C2410C" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="80" cy="82" r="22" fill="#FEF08A"/>
        <path d="M68 84 C74 72, 86 72, 92 84 C84 92, 74 92, 68 84 Z" fill="#F59E0B" stroke="#B45309" stroke-width="2"/>
        <rect x="58" y="50" width="44" height="6" rx="3" fill="#FED7AA"/>
      </svg>`;

    case 'ly-giu-nhiet':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#E0F2FE"/>
        <rect x="54" y="42" width="52" height="86" rx="14" fill="#38BDF8" stroke="#0284C7" stroke-width="3"/>
        <rect x="50" y="34" width="60" height="14" rx="7" fill="#0F172A"/>
        <path d="M106 62 H118 C124 62, 126 70, 126 82 C126 94, 124 102, 118 102 H106" stroke="#0284C7" stroke-width="6" stroke-linecap="round"/>
        <rect x="64" y="56" width="8" height="58" rx="4" fill="#E0F2FE" opacity="0.65"/>
        <circle cx="86" cy="86" r="8" fill="#FFFFFF" opacity="0.8"/>
      </svg>`;

    case 'tui-coi':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FEF9C3"/>
        <path d="M60 66 C60 40, 100 40, 100 66" stroke="#92400E" stroke-width="6" stroke-linecap="round"/>
        <path d="M40 66 H120 L112 126 C111 130, 106 132, 80 132 C54 132, 49 130, 48 126 Z" fill="#FDE68A" stroke="#B45309" stroke-width="3"/>
        <line x1="45" y1="84" x2="115" y2="84" stroke="#D97706" stroke-width="2.5" stroke-dasharray="8 6"/>
        <line x1="47" y1="100" x2="113" y2="100" stroke="#D97706" stroke-width="2.5" stroke-dasharray="8 6"/>
        <line x1="49" y1="116" x2="111" y2="116" stroke="#D97706" stroke-width="2.5" stroke-dasharray="8 6"/>
        <path d="M72 68 L80 76 L88 68 L80 62 Z" fill="#FFF1F2" stroke="#FB7185" stroke-width="2"/>
      </svg>`;

    case 'vai-hoa':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#FCE7F3"/>
        <rect x="38" y="48" width="84" height="68" rx="14" fill="#FFF1F2" stroke="#EC4899" stroke-width="3"/>
        <ellipse cx="44" cy="82" rx="10" ry="34" fill="#FBCFE8" stroke="#EC4899" stroke-width="3"/>
        <circle cx="72" cy="68" r="6" fill="#F472B6"/>
        <circle cx="72" cy="68" r="2.2" fill="#FEF08A"/>
        <circle cx="100" cy="76" r="6.5" fill="#EC4899"/>
        <circle cx="100" cy="76" r="2.2" fill="#FEF08A"/>
        <circle cx="84" cy="98" r="6" fill="#FB7185"/>
        <circle cx="84" cy="98" r="2.2" fill="#FEF08A"/>
        <circle cx="108" cy="100" r="4.5" fill="#F472B6"/>
      </svg>`;

    case 'khan':
      return `<svg ${s}>
        <circle cx="80" cy="82" r="64" fill="#E0E7FF"/>
        <rect x="38" y="92" width="84" height="30" rx="12" fill="#C7D2FE" stroke="#6366F1" stroke-width="3"/>
        <rect x="42" y="68" width="76" height="28" rx="12" fill="#E0E7FF" stroke="#6366F1" stroke-width="3"/>
        <rect x="46" y="46" width="68" height="26" rx="11" fill="#FFFFFF" stroke="#6366F1" stroke-width="3"/>
        <line x1="56" y1="59" x2="104" y2="59" stroke="#A5B4FC" stroke-width="3" stroke-linecap="round"/>
        <line x1="52" y1="82" x2="108" y2="82" stroke="#818CF8" stroke-width="3" stroke-linecap="round"/>
      </svg>`;

    default:
      return `<svg ${s}>
        <circle cx="80" cy="82" r="60" fill="#FEE2E2"/>
        <rect x="50" y="52" width="60" height="60" rx="12" fill="#FFFFFF" stroke="#EF4444" stroke-width="3"/>
      </svg>`;
  }
}
