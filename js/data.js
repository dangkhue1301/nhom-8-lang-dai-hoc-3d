export const STAGES = {
  1: {
    id: 1,
    key: 'bao-cap',
    badge: 'CHẶNG 1 / 3 · THỜI BAO CẤP',
    title: 'Tem phiếu Làng Đại Học',
    subtitle:
      'Chỉ **KTX cũ & Căng tin Quốc doanh** được mở; 4 khu đất còn lại **cấm tư nhân kinh doanh**.',
    objective:
      'Bấm **[🎟️ Phát phiếu cơm]** phục vụ dòng SV xếp hàng — thấy rõ vì sao cơ chế xin–cho **tắc nghẽn**!',
    takeawayBadge: 'Tính tất yếu khách quan · Ý 1',
    takeawayTitle: 'Cấp phát tem phiếu không theo kịp nhu cầu thực tế!',
    takeawayBody:
      '**Xin – cho thủ công** làm SV xếp hàng dài, thiếu nguồn lực đầu tư → **tất yếu phải mở Kinh tế thị trường**.',
    nextButton: 'Phá rào · Sang Chặng 2 →'
  },
  2: {
    id: 2,
    key: 'tha-noi',
    badge: 'CHẶNG 2 / 3 · THỊ TRƯỜNG THẢ NỔI',
    title: 'Tự do hoàn toàn (Không điều tiết)',
    subtitle:
      '**Mở cửa cạnh tranh!** Nhà trọ, quán ăn mọc cực nhanh — kinh tế tăng vọt khi **Nhà nước đứng ngoài**.',
    objective:
      'Xem **3 diễn biến** và chạm thử 1 khu nhà xem có can thiệp được khuyết tật thị trường không!',
    takeawayBadge: 'Giới hạn của Thị trường tự do',
    takeawayTitle: 'Tăng trưởng nóng — nhưng Độc quyền & Kẹt xe bùng phát!',
    takeawayBody:
      'Thị trường **tăng trưởng nhanh**, nhưng thiếu **Nhà nước quản lý** sẽ sinh **cò trọ x3 giá, mất ATTP, bỏ rơi người nghèo**.',
    nextButton: 'Bắt đầu Chặng 3 · Quy hoạch 3D →'
  },
  3: {
    id: 3,
    key: 'xhcn',
    badge: 'CHẶNG 3 / 3 · KTTT ĐỊNH HƯỚNG XHCN',
    title: 'Quy hoạch Làng ĐH Thủ Đức 3D',
    subtitle:
      'Giữ sức bật thị trường, đồng thời dùng **công cụ điều tiết Nhà nước** trên **6 khu đất 3D**!',
    objective:
      'Mẹo: Mở **[💼 Hub Khởi Nghiệp]** lấy **+35tr thuế**, rồi phối hợp **KTX công, ATTP, Xe buýt 3.000đ**.',
    takeawayBadge: 'Hoàn tất Quy hoạch Làng ĐH 3D',
    takeawayTitle: 'Tổng kết Làng Đại Học 3D',
    takeawayBody:
      'Xem biểu đồ **3 thời kỳ** và bấm vào **5 đặc trưng** để camera bay tới công trình tương ứng.',
    nextButton: 'Xem Tổng kết →'
  }
};

export const STAGE2_WAVES = [
  {
    step: 1,
    title: 'Diễn biến 1/3 · Cò trọ thổi giá phòng gấp 3 lần!',
    detail: 'Nhà trọ tư nhân mọc kín nhưng không có KTX công làm chuẩn giá — sinh viên phải thuê phòng chật giá cắt cổ.'
  },
  {
    step: 2,
    title: 'Diễn biến 2/3 · Kẹt xe giờ cao điểm & Quán xá mất vệ sinh!',
    detail: 'Bãi xe tự phát hét giá 50k/lượt, không có kiểm tra an toàn thực phẩm, khói bụi và ùn tắc khắp Đại Lộ Sinh Viên.'
  },
  {
    step: 3,
    title: 'Diễn biến 3/3 · Chỉ phục vụ VIP, bỏ rơi sinh viên khó khăn!',
    detail: 'Quán cà phê học bài 90k/ly, phòng khám đắt đỏ, học bổng bị cắt — khoảng cách giàu nghèo trong Làng Đại Học nới rộng!'
  }
];

export const LOTS = [
  {
    id: 'housing',
    name: 'KTX Khu A & Phố Trọ Tạ Quang Bửu',
    shortName: 'KTX & Trọ',
    icon: '🏠',
    pos: { x: -13.0, z: -8.0 },
    characteristicId: 'so-huu',
    baocapState: 'baocap',
    marketState: 'private',
    choices: {
      private: {
        id: 'private',
        badge: 'Tư nhân thả nổi',
        label: 'Bán đất cho tư nhân xây trọ VIP',
        cost: -15,
        economy: 10,
        studentLife: -12,
        desc: 'Thu ngay +15tr, Kinh tế +10, nhưng cò trọ thổi giá x3 làm sinh viên chật vật (-12 Đời sống).'
      },
      state: {
        id: 'state',
        badge: 'Bao cấp toàn phần',
        label: '100% KTX Bao cấp miễn phí',
        cost: 42,
        economy: -4,
        studentLife: 10,
        desc: 'Tốn 42tr ngân sách, Đời sống +10 nhưng dễ thiếu vốn bảo trì và cứng nhắc (-4 Kinh tế).'
      },
      xhcn: {
        id: 'xhcn',
        badge: 'Định hướng XHCN',
        label: 'KTX Nhà nước chủ đạo + Trọ tư nhân minh bạch',
        cost: 18,
        economy: 8,
        studentLife: 15,
        unlocks: ['so-huu'],
        desc: 'KTX công giữ giá trần hợp lý, trọ tư nhân cạnh tranh sòng phẳng (+8 Kinh tế, +15 Đời sống).',
        insight:
          'Đặc trưng 2 (Sở hữu): Kinh tế nhà nước (KTX công) giữ vai trò chủ đạo cùng kinh tế tư nhân hợp tác – cạnh tranh!'
      }
    }
  },
  {
    id: 'food',
    name: 'Chợ Đêm & Phố Ẩm Thực Làng ĐH',
    shortName: 'Chợ Đêm Ẩm Thực',
    icon: '🍜',
    pos: { x: 13.0, z: -8.0 },
    characteristicId: 'quan-ly',
    baocapState: 'baocap',
    marketState: 'private',
    choices: {
      private: {
        id: 'private',
        badge: 'Tư nhân thả nổi',
        label: 'Bỏ kiểm tra vệ sinh, chuỗi lớn tự do ép giá',
        cost: -10,
        economy: 9,
        studentLife: -11,
        desc: 'Thu +10tr, Kinh tế +9, nhưng rác thải, lấn vỉa hè & đồ ăn kém an toàn (-11 Đời sống).'
      },
      state: {
        id: 'state',
        badge: 'Bao cấp toàn phần',
        label: 'Đóng quán ngoài, chỉ mở 1 Căng tin Quốc doanh',
        cost: 34,
        economy: -6,
        studentLife: 6,
        desc: 'Tốn 34tr ngân sách, thực đơn đơn điệu và xếp hàng lâu giờ trưa (-6 Kinh tế).'
      },
      xhcn: {
        id: 'xhcn',
        badge: 'Định hướng XHCN',
        label: 'Tự do mở quán + Chuẩn An toàn Thực phẩm & chống ép phí',
        cost: 14,
        economy: 9,
        studentLife: 12,
        unlocks: ['quan-ly'],
        desc: 'Sinh viên thoải mái chọn quán ngon sạch, tiểu thương cạnh tranh công bằng (+9 Kinh tế, +12 Đời sống).',
        insight:
          'Đặc trưng 3 (Quản lý): Nhà nước quản lý bằng pháp luật & kiểm chuẩn ATTP để thị trường vận hành lành mạnh!'
      }
    }
  },
  {
    id: 'transit',
    name: 'Bến Xe Buýt 08/33 & Ga Metro Số 1',
    shortName: 'Buýt & Metro',
    icon: '🚌',
    pos: { x: 0.0, z: 9.2 },
    characteristicId: 'gan-ket',
    baocapState: 'fenced',
    marketState: 'private',
    choices: {
      private: {
        id: 'private',
        badge: 'Tư nhân thả nổi',
        label: 'Bãi xe tư nhân thu phí giờ cao điểm 50k',
        cost: -12,
        economy: 7,
        studentLife: -12,
        desc: 'Thu +12tr, Kinh tế +7, nhưng ùn tắc xe máy kín đường và tốn kém cho SV (-12 Đời sống).'
      },
      state: {
        id: 'state',
        badge: 'Bao cấp toàn phần',
        label: 'Cấm xe cá nhân, phát vé đi lại theo chỉ tiêu',
        cost: 36,
        economy: -5,
        studentLife: 6,
        desc: 'Tốn 36tr, hạn chế đi lại làm thêm & học nhóm (-5 Kinh tế).'
      },
      xhcn: {
        id: 'xhcn',
        badge: 'Định hướng XHCN',
        label: 'Tuyến Xe Buýt 3.000đ trợ giá + Hoàn thiện Ga Metro Số 1',
        cost: 20,
        economy: 6,
        studentLife: 15,
        unlocks: ['gan-ket'],
        desc: 'Đồng bộ Ga Metro ĐHQG & xe buýt xanh 3.000đ chạy thông thoáng khắp Làng ĐH, giảm hẳn kẹt xe (+6 Kinh tế, +15 Đời sống)!',
        insight:
          'Đặc trưng 5 (Công bằng): Hạ tầng Metro & xe buýt trợ giá gắn tăng trưởng với tiện ích mọi sinh viên.'
      }
    }
  },
  {
    id: 'jobs',
    name: 'Khu Khởi Nghiệp & Công Nghệ (UIT/BK)',
    shortName: 'Hub Khởi Nghiệp',
    icon: '💼',
    pos: { x: -13.0, z: 7.8 },
    characteristicId: 'muc-tieu',
    baocapState: 'fenced',
    marketState: 'private',
    choices: {
      private: {
        id: 'private',
        badge: 'Tư nhân thả nổi',
        label: 'Chỉ ưu đãi tập đoàn lớn, không quy định lương thực tập',
        cost: -25,
        economy: 14,
        studentLife: -8,
        desc: 'Thu +25tr, Kinh tế +14, nhưng nhiều SV thực tập bị bóc lột không lương (-8 Đời sống).'
      },
      state: {
        id: 'state',
        badge: 'Bao cấp toàn phần',
        label: 'Phân công việc hành chính cố định',
        cost: 28,
        economy: -5,
        studentLife: 5,
        desc: 'Tốn 28tr, triệt tiêu sáng tạo và không thu hút được dự án mới (-5 Kinh tế).'
      },
      xhcn: {
        id: 'xhcn',
        badge: 'Định hướng XHCN',
        label: 'Hub Khởi nghiệp SV + Doanh nghiệp FDI đóng thuế bền vững',
        cost: -35,
        economy: 16,
        studentLife: 10,
        unlocks: ['muc-tieu'],
        desc: 'Tạo nguồn thu +35tr ngân sách để tái đầu tư toàn khu, mở nhiều việc làm trả lương xứng đáng!',
        insight:
          'Đặc trưng 1 (Mục tiêu): Phát triển lực lượng sản xuất hiện đại gắn nâng cao đời sống và tạo quỹ xã hội!'
      }
    }
  },
  {
    id: 'study',
    name: 'Nhà Văn Hóa SV & Thư Viện Mở',
    shortName: 'NVH Sinh Viên',
    icon: '📚',
    pos: { x: 0.0, z: -10.0 },
    characteristicId: 'phan-phoi',
    baocapState: 'fenced',
    marketState: 'private',
    choices: {
      private: {
        id: 'private',
        badge: 'Tư nhân thả nổi',
        label: 'Chuỗi cà phê VIP thu phí 90k/ly',
        cost: -10,
        economy: 8,
        studentLife: -9,
        desc: 'Thu +10tr, Kinh tế +8, nhưng sinh viên không đủ tiền đành ngồi hành lang (-9 Đời sống).'
      },
      state: {
        id: 'state',
        badge: 'Bao cấp toàn phần',
        label: 'Phòng đọc cũ hạn chế giờ mở cửa',
        cost: 28,
        economy: -2,
        studentLife: 7,
        desc: 'Tốn 28tr, thiếu Wi-Fi tốc độ cao và phòng làm việc nhóm (-2 Kinh tế).'
      },
      xhcn: {
        id: 'xhcn',
        badge: 'Định hướng XHCN',
        label: 'Thư viện Mở Wi-Fi công miễn phí + Góc Cà phê Sinh viên',
        cost: 16,
        economy: 7,
        studentLife: 13,
        unlocks: ['phan-phoi'],
        desc: 'Không gian sáng tạo miễn phí cho mọi SV, nâng mặt bằng tri thức & thu hút startup (+7 Kinh tế, +13 Đời sống).',
        insight:
          'Đặc trưng 4 (Phân phối): Tái phân phối nguồn thuế qua hạ tầng tri thức công giúp thu hẹp khoảng cách cơ hội.'
      }
    }
  },
  {
    id: 'welfare',
    name: 'Trạm Y Tế ĐHQG & Quỹ Học Bổng',
    shortName: 'Y Tế & Học Bổng',
    icon: '🎓',
    pos: { x: 13.0, z: 7.8 },
    characteristicId: 'phan-phoi',
    baocapState: 'fenced',
    marketState: 'private',
    choices: {
      private: {
        id: 'private',
        badge: 'Tư nhân thả nổi',
        label: 'Phòng khám tư nhân giá cao, cắt học bổng',
        cost: -12,
        economy: 6,
        studentLife: -12,
        desc: 'Thu +12tr, nhưng chi phí khám bệnh cao và nhiều SV giỏi thiếu học bổng (-12 Đời sống).'
      },
      state: {
        id: 'state',
        badge: 'Bao cấp toàn phần',
        label: 'Cấp phát bình quân không xét kết quả học tập',
        cost: 38,
        economy: -4,
        studentLife: 8,
        desc: 'Tốn 38tr, chia đều không tạo động lực vươn lên (-4 Kinh tế).'
      },
      xhcn: {
        id: 'xhcn',
        badge: 'Định hướng XHCN',
        label: 'Quỹ Học bổng Tài năng + Y tế KTX & Đào tạo thực chiến',
        cost: 22,
        economy: 10,
        studentLife: 14,
        unlocks: ['phan-phoi', 'gan-ket'],
        desc: 'Khen thưởng đúng năng lực đi đôi y tế an sinh giá rẻ — vừa công bằng vừa nâng chất lượng nhân lực (+10 Kinh tế, +14 Đời sống)!',
        insight:
          'Đặc trưng 4 & 5: Kết hợp phân phối theo năng lực học tập với an sinh Y tế ngay trong từng bước phát triển!'
      }
    }
  }
];

export const EVENTS = [
  {
    id: 'ev-rent-surge',
    triggerAfterLots: 3,
    badge: 'TÌNH HUỐNG #1 · MÙA NHẬP HỌC',
    title: 'Tân sinh viên nhập học, cò trọ thổi giá gấp đôi!',
    prompt:
      'Hàng nghìn tân sinh viên đổ về Làng Đại Học tìm phòng; một số chủ trọ tự ý tăng giá và thu tiền điện nước cắt cổ. Ban Quản lý xử lý thế nào?',
    optionA: {
      id: 'A',
      label: 'A · Để thị trường tự điều chỉnh cung – cầu',
      summary: 'Không chi ngân sách (+10tr Quỹ, +4 Kinh tế), nhưng sinh viên bị ép giá phòng (-10 Đời sống).',
      shortTag: 'Thả nổi giá trọ',
      budgetDelta: 10,
      economyDelta: 4,
      studentLifeDelta: -10
    },
    optionB: {
      id: 'B',
      label: 'B · Mở Cổng thông tin trọ minh bạch & Tăng suất KTX ưu tiên',
      summary: 'Chi 12tr ngân sách (-12tr Quỹ), kiểm soát giá điện nước công khai (+3 Kinh tế, +10 Đời sống SV).',
      shortTag: 'Cổng trọ minh bạch & KTX hỗ trợ',
      budgetDelta: -12,
      economyDelta: 3,
      studentLifeDelta: 10
    }
  },
  {
    id: 'ev-grad-skills',
    triggerAfterLots: 6,
    badge: 'TÌNH HUỐNG #2 · MÙA TỐT NGHIỆP',
    title: 'Sinh viên năm cuối thiếu kỹ năng thực chiến & việc làm!',
    prompt:
      'Doanh nghiệp phản hồi nhiều sinh viên tốt nghiệp chưa đáp ứng kịp công việc mới, trong khi các khóa đào tạo bên ngoài học phí quá cao.',
    optionA: {
      id: 'A',
      label: 'A · Để sinh viên tự xoay xở học phí bên ngoài',
      summary: 'Giữ ngân sách (+12tr Quỹ, +2 Kinh tế), nhưng tỷ lệ thất nghiệp tăng làm Đời sống SV -10.',
      shortTag: 'Để SV tự xoay xở',
      budgetDelta: 12,
      economyDelta: 2,
      studentLifeDelta: -10
    },
    optionB: {
      id: 'B',
      label: 'B · Trích thuế mở Trại Kỹ năng Thực chiến & Học bổng Doanh nghiệp',
      summary: 'Đầu tư -14tr Quỹ giúp sinh viên có việc ngay, tăng mạnh cả Kinh tế (+10) lẫn Đời sống SV (+10)!',
      shortTag: 'Trại Kỹ năng & Học bổng DN',
      budgetDelta: -14,
      economyDelta: 10,
      studentLifeDelta: 10
    }
  }
];

export const CHARACTERISTICS = [
  {
    id: 'muc-tieu',
    order: 1,
    name: 'Mục tiêu phát triển',
    shortName: '1. Mục tiêu',
    icon: '💼',
    focusLotId: 'jobs',
    keywords: ['Dân giàu, nước mạnh', 'Phát triển LLSX', 'Nâng cao đời sống'],
    textbook:
      'Phát triển **lực lượng sản xuất hiện đại** gắn với **nâng cao đời sống nhân dân** (“dân giàu, nước mạnh, dân chủ, công bằng, văn minh”).',
    campusExample:
      '**Làng ĐH 3D:** Mở **Hub Khởi Nghiệp & FDI** tạo việc làm lương tốt + **+35tr thuế** nuôi toàn khu.'
  },
  {
    id: 'so-huu',
    order: 2,
    name: 'Sở hữu & Nhiều thành phần',
    shortName: '2. Sở hữu',
    icon: '🏠',
    focusLotId: 'housing',
    keywords: ['Kinh tế nhà nước chủ đạo', 'Tư nhân là động lực', 'Cạnh tranh bình đẳng'],
    textbook:
      '**Nhiều thành phần kinh tế** cùng hợp tác – cạnh tranh; **Kinh tế nhà nước giữ vai trò chủ đạo**, **tư nhân là động lực quan trọng**.',
    campusExample:
      '**Làng ĐH 3D:** **KTX Nhà nước** giữ giá trần ổn định + **nhà trọ tư nhân** phong phú cùng phục vụ SV.'
  },
  {
    id: 'quan-ly',
    order: 3,
    name: 'Quan hệ quản lý',
    shortName: '3. Quản lý',
    icon: '🍜',
    focusLotId: 'food',
    keywords: ['Nhà nước pháp quyền XHCN', 'Quản lý bằng pháp luật', 'Khắc phục khuyết tật'],
    textbook:
      '**Nhà nước pháp quyền XHCN** (dưới sự lãnh đạo của Đảng) điều tiết bằng **pháp luật, quy hoạch** để **khắc phục khuyết tật thị trường**.',
    campusExample:
      '**Làng ĐH 3D:** **Chợ Đêm Ẩm Thực** tự do buôn bán nhưng phải đạt **chuẩn ATTP** & không ép giá.'
  },
  {
    id: 'phan-phoi',
    order: 4,
    name: 'Quan hệ phân phối',
    shortName: '4. Phân phối',
    icon: '📚',
    focusLotId: 'study',
    keywords: ['Theo kết quả lao động', 'Theo hiệu quả & vốn', 'Qua an sinh phúc lợi'],
    textbook:
      'Kết hợp **nhiều hình thức phân phối**: chủ yếu theo **kết quả lao động – hiệu quả** và tái phân phối qua **an sinh, phúc lợi xã hội**.',
    campusExample:
      '**Làng ĐH 3D:** Làm thêm hưởng **lương xứng đáng** + nhận **học bổng tài năng**, đi đôi **NVH SV & Wi-Fi công miễn phí**.'
  },
  {
    id: 'gan-ket',
    order: 5,
    name: 'Gắn tăng trưởng với công bằng',
    shortName: '5. Công bằng',
    icon: '🚌',
    focusLotId: 'transit',
    keywords: ['Công bằng ngay từng bước', 'Không chờ giàu mới lo', 'Bao phủ mọi SV'],
    textbook:
      'Thực hiện **tiến bộ và công bằng xã hội ngay trong từng bước phát triển**, không chờ kinh tế giàu rồi mới lo an sinh.',
    campusExample:
      '**Làng ĐH 3D:** Đầu tư ngay **Xe buýt 3.000đ** & **Y tế KTX** song song lúc mở rộng khu phố.'
  }
];

export const LESSON_NOTES = {
  conceptHighlights: ['Quy luật thị trường', 'Định hướng XHCN', 'Nhà nước quản lý (Đảng lãnh đạo)'],
  fullConcept:
    'Vận hành **đồng bộ theo quy luật thị trường**, dưới sự quản lý của **Nhà nước pháp quyền XHCN** (Đảng lãnh đạo), vì mục tiêu **dân giàu, nước mạnh, công bằng, văn minh**.',
  inevitabilityPoints: [
    {
      title: '1. Xu hướng khách quan',
      detail: '**Chặng 1 (Bao cấp)** gây tắc nghẽn → thị trường giải phóng nguồn lực.'
    },
    {
      title: '2. Ưu thế vượt trội',
      detail: '**Đầu Chặng 2** cho thấy cạnh tranh thúc đẩy dịch vụ, việc làm bứt tốc.'
    },
    {
      title: '3. Khắc phục khuyết tật',
      detail: '**Chặng 3** kết hợp điều tiết Nhà nước để chống độc quyền, bảo vệ sinh viên.'
    }
  ],
  discussionQuestion:
    '**Chốt phản biện:** Thị trường tự do giúp tăng GDP nhanh nhưng đẻ ra **độc quyền & phân hóa** (Chặng 2). Chỉ khi Nhà nước nắm **KTX công, luật ATTP & xe buýt trợ giá** (Chặng 3), tăng trưởng mới phục vụ số đông.'
};
