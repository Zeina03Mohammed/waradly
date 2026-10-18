/* English ⇄ Arabic toggle. Loaded in every page's <head>.
 *
 * Pages stay written in English; in Arabic mode this swaps every text node / placeholder / title
 * whose English text is in AR below (including content rendered later by page scripts, via a
 * MutationObserver), flips the page to RTL, and translates alert/confirm dialogs. A string missing
 * from AR simply stays in English — add it here.
 * ponytail: exact-string dictionary, no keys in markup; move to data-i18n keys if strings start
 * colliding with user content. */
(() => {
  const STORAGE_KEY = 'waradly_lang';
  let lang = 'en';
  try { lang = localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'; } catch { /* storage blocked */ }

  const root = document.documentElement;

  function setLang(next) {
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked */ }
    location.reload();
  }

  const GLOBE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  function toggleButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-toggle';
    btn.innerHTML = GLOBE;
    const label = lang === 'ar' ? 'English' : 'العربية';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => setLang(lang === 'ar' ? 'en' : 'ar'));
    return btn;
  }

  // Landing → header next to Log in; dashboards → shell.js places it in the sidebar/topbar;
  // pages with neither (login, register, …) → fixed top corner.
  function addToggle() {
    if (document.getElementById('sidebar-slot')) return;
    const header = document.querySelector('.l-auth');
    if (header) return header.prepend(toggleButton());
    const btn = toggleButton();
    btn.classList.add('lang-toggle-floating');
    document.body.appendChild(btn);
  }

  window.waradlyI18n = { lang, setLang, toggleButton, translate: () => {} };

  if (lang !== 'ar') {
    document.addEventListener('DOMContentLoaded', addToggle);
    return;
  }

  root.lang = 'ar';
  root.dir = 'rtl';
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap';
  document.head.appendChild(font);

  const AR = {
    // Brand / shell / navigation
    'Waradly': 'Waradly',
    'Dashboard': 'لوحة التحكم',
    'My RFQs': 'طلبات التسعير',
    'Available RFQs': 'طلبات التسعير المتاحة',
    'My Offers': 'عروضي',
    'Orders': 'الطلبات',
    'Profile': 'الملف الشخصي',
    'Performance': 'الأداء',
    'Verification': 'التوثيق',
    'Capabilities': 'القدرات',
    'Audit Log': 'سجل التدقيق',
    'RFQ Review': 'مراجعة طلبات التسعير',
    'Offers': 'العروض',
    'Categories': 'الفئات',
    'Users': 'المستخدمون',
    'Supplier Verification': 'توثيق الموردين',
    'Message Flags': 'بلاغات الرسائل',
    'Disputes': 'النزاعات',
    'Messages': 'الرسائل',
    'Marketplace': 'السوق',
    'Account': 'الحساب',
    'Overview': 'نظرة عامة',
    'Moderation': 'الإشراف',
    'Log out': 'تسجيل الخروج',
    'Open menu': 'فتح القائمة',
    'Something went wrong.': 'حدث خطأ ما.',
    'Session expired.': 'انتهت الجلسة.',
    'Loading…': 'جارٍ التحميل…',

    // Landing page
    'Waradly — B2B Procurement Marketplace for Custom Sourcing': 'Waradly — سوق مشتريات للشركات للتوريد حسب الطلب',
    'Sections': 'الأقسام',
    'Footer': 'تذييل الصفحة',
    'How it works': 'كيف يعمل',
    'For buyers': 'للمشترين',
    'For suppliers': 'للموردين',
    'Log in': 'تسجيل الدخول',
    'Sign up': 'إنشاء حساب',
    'B2B procurement marketplace': 'سوق مشتريات بين الشركات',
    'Source custom products from': 'ورّد منتجات حسب الطلب من',
    'verified suppliers': 'موردين موثّقين',
    '— without the back-and-forth.': '— دون مراسلات لا تنتهي.',
    'Describe what you need once. Qualified suppliers compete with offers, you pick the best one, and our team manages the order through production, quality checks and delivery.':
      'صِف ما تحتاجه مرة واحدة. يتنافس الموردون المؤهلون بعروضهم، وتختار الأفضل، ويتولى فريقنا إدارة الطلب خلال الإنتاج وفحص الجودة والتسليم.',
    'Post your first RFQ': 'انشر أول طلب تسعير',
    'Join as a supplier': 'انضم كمورّد',
    'Example of an RFQ receiving offers': 'مثال على طلب تسعير يتلقى عروضًا',
    'Example RFQ': 'مثال على طلب تسعير',
    'Custom printed shipping boxes': 'صناديق شحن مطبوعة حسب الطلب',
    '5,000 pcs · Packaging · Deliver by 15 Nov': '5,000 قطعة · تغليف · التسليم قبل 15 نوفمبر',
    'Receiving offers': 'يتلقى عروضًا',
    'Supplier #1': 'المورّد رقم 1',
    'Supplier #2': 'المورّد رقم 2',
    'Supplier #3': 'المورّد رقم 3',
    'Lead time 18 days · Sample included': 'مدة التنفيذ 18 يومًا · تشمل عينة',
    'Lead time 12 days': 'مدة التنفيذ 12 يومًا',
    'Lead time 21 days · Sample included': 'مدة التنفيذ 21 يومًا · تشمل عينة',
    'Best price': 'أفضل سعر',
    'Supplier identities stay private until the platform connects you.': 'تبقى هويات الموردين سرية حتى تربطكم المنصة.',
    'RFQ approved': 'تمت الموافقة على الطلب',
    'Sent to eligible suppliers': 'أُرسل إلى الموردين المؤهلين',
    'Why Waradly': 'لماذا Waradly',
    'Verified suppliers': 'موردون موثّقون',
    'Every supplier is identity-checked and approved per category.': 'يتم التحقق من هوية كل مورّد واعتماده لكل فئة.',
    'Reviewed RFQs': 'طلبات تسعير مُراجَعة',
    'Our team checks each request before it reaches suppliers.': 'يراجع فريقنا كل طلب قبل وصوله إلى الموردين.',
    'Protected identities': 'هويات محمية',
    'Contact details stay private on both sides of the deal.': 'تبقى بيانات التواصل سرية لدى الطرفين.',
    'Managed orders': 'طلبات مُدارة',
    'Tracked step by step from payment to delivery.': 'متابعة خطوة بخطوة من الدفع حتى التسليم.',
    'From request to delivered order in four steps': 'من الطلب إلى التسليم في أربع خطوات',
    'One request replaces dozens of emails and calls. Waradly handles the matching and the follow-up.':
      'طلب واحد يغنيك عن عشرات الرسائل والمكالمات. تتولى Waradly المطابقة والمتابعة.',
    'Post an RFQ': 'انشر طلب تسعير',
    'Describe the product, quantity, specs and delivery deadline. Attach drawings or references.':
      'صِف المنتج والكمية والمواصفات وموعد التسليم. أرفق الرسومات أو المراجع.',
    'We review it': 'نراجعه',
    'Our team approves the request and sends it only to suppliers approved for that category.':
      'يعتمد فريقنا الطلب ويرسله فقط إلى الموردين المعتمدين في تلك الفئة.',
    'Compare offers': 'قارن العروض',
    'Suppliers submit competing offers. Compare price, lead time and terms side by side.':
      'يقدّم الموردون عروضًا متنافسة. قارن السعر ومدة التنفيذ والشروط جنبًا إلى جنب.',
    'Track your order': 'تابع طلبك',
    'Accept the best offer and follow production, quality checks and delivery in one place.':
      'اقبل أفضل عرض وتابع الإنتاج وفحص الجودة والتسليم في مكان واحد.',
    'Get better offers with less effort': 'احصل على عروض أفضل بجهد أقل',
    'Stop chasing quotes. Post once and let qualified suppliers come to you.': 'توقف عن ملاحقة عروض الأسعار. انشر مرة واحدة ودع الموردين المؤهلين يأتون إليك.',
    'Competing offers from verified suppliers only': 'عروض متنافسة من موردين موثّقين فقط',
    'Compare price, lead time and samples side by side': 'قارن السعر ومدة التنفيذ والعينات جنبًا إلى جنب',
    'Every order tracked through quality checks and delivery': 'كل طلب متابَع حتى فحص الجودة والتسليم',
    'Reorder past purchases in a couple of clicks': 'أعد طلب مشترياتك السابقة بنقرتين',
    'Create a buyer account': 'أنشئ حساب مشترٍ',
    'Qualified requests, straight to you': 'طلبات مؤهلة تصلك مباشرة',
    'Win new business without cold outreach. Receive RFQs that match what you actually make.': 'اكسب عملاء جددًا دون تسويق مباشر. استقبل طلبات تسعير تطابق ما تصنعه فعلًا.',
    'RFQs matched to your approved categories': 'طلبات تسعير مطابقة لفئاتك المعتمدة',
    'Every request reviewed before it reaches you': 'كل طلب يُراجَع قبل أن يصلك',
    'Submit, edit or withdraw offers before the deadline': 'قدّم عروضك أو عدّلها أو اسحبها قبل الموعد النهائي',
    'Build a track record with ratings on completed orders': 'ابنِ سجلًا موثوقًا بالتقييمات على الطلبات المكتملة',
    'Apply as a supplier': 'قدّم كمورّد',
    'Know exactly where every order stands': 'اعرف حالة كل طلب بدقة',
    "Each order moves through clear stages, and you're notified as it progresses.": 'يمر كل طلب بمراحل واضحة، ويصلك إشعار مع كل تقدّم.',
    'Offer selected': 'تم اختيار العرض',
    'You accept the best offer': 'تقبل أفضل عرض',
    'Payment confirmed': 'تم تأكيد الدفع',
    'Order is locked in': 'تم تثبيت الطلب',
    'Production': 'الإنتاج',
    'With optional sample review': 'مع مراجعة اختيارية للعينة',
    'Quality check': 'فحص الجودة',
    'Inspected before dispatch': 'يُفحص قبل الشحن',
    'In transit': 'قيد الشحن',
    'On its way to you': 'في الطريق إليك',
    'Delivered': 'تم التسليم',
    'Confirm and rate': 'أكّد وقيّم',
    'Ready to source smarter?': 'مستعد للتوريد بذكاء أكبر؟',
    'Create a free account and post your first request for quotation in minutes.': 'أنشئ حسابًا مجانيًا وانشر أول طلب تسعير خلال دقائق.',
    'Sign up free': 'سجّل مجانًا',
    'Waradly — Solutions that grow with you': 'Waradly — حلول تنمو معك',

    // Auth pages
    'Log in — Waradly B2B Procurement Marketplace': 'تسجيل الدخول — Waradly سوق المشتريات للشركات',
    'Create a Free Account — Waradly for Buyers & Suppliers': 'أنشئ حسابًا مجانيًا — Waradly للمشترين والموردين',
    'Email': 'البريد الإلكتروني',
    'Password': 'كلمة المرور',
    'No account yet?': 'ليس لديك حساب؟',
    'Register': 'سجّل',
    'Forgot password?': 'نسيت كلمة المرور؟',
    'Contact support if you believe this is a mistake.': 'تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.',
    'Close': 'إغلاق',
    'Logging in…': 'جارٍ تسجيل الدخول…',
    'Create an account': 'إنشاء حساب',
    'Buyer': 'مشترٍ',
    'Supplier': 'مورّد',
    'Username': 'اسم المستخدم',
    'Phone number': 'رقم الهاتف',
    'Confirm password': 'تأكيد كلمة المرور',
    'Company legal name': 'الاسم القانوني للشركة',
    'Country': 'الدولة',
    'General region': 'المنطقة',
    "You'll pick which categories you supply from your Capabilities page after logging in.": 'ستختار الفئات التي تورّدها من صفحة القدرات بعد تسجيل الدخول.',
    'I confirm I am at least 18 years old and registering on behalf of a business, and I agree to the Terms, Anti-Circumvention Policy, and Privacy Policy.':
      'أؤكد أن عمري 18 عامًا على الأقل وأنني أسجّل نيابة عن شركة، وأوافق على الشروط وسياسة منع التحايل وسياسة الخصوصية.',
    'Create account': 'إنشاء الحساب',
    'Already have an account?': 'لديك حساب بالفعل؟',
    'Check your email': 'تحقق من بريدك الإلكتروني',
    'Your account was created. We sent a verification link to': 'تم إنشاء حسابك. أرسلنا رابط التحقق إلى',
    '. Once verified you can log in.': '. بعد التحقق يمكنك تسجيل الدخول.',
    "Supplier accounts require a one-time identity check — add your photo, then verify it's really you with Face ID.":
      'تتطلب حسابات الموردين تحققًا لمرة واحدة من الهوية — أضف صورتك ثم أكّد أنك أنت باستخدام Face ID.',
    'Upload your photo (required)': 'ارفع صورتك (مطلوب)',
    'Photo uploaded.': 'تم رفع الصورة.',
    'Verify with Face ID (required)': 'تحقق باستخدام Face ID (مطلوب)',
    'Face ID verification complete.': 'اكتمل التحقق باستخدام Face ID.',
    "Face ID verification is required for supplier accounts, but this browser doesn't support it. Open this page in a browser with Face ID / Touch ID / Windows Hello / security key support to finish registering.":
      'التحقق باستخدام Face ID مطلوب لحسابات الموردين، لكن هذا المتصفح لا يدعمه. افتح هذه الصفحة في متصفح يدعم Face ID أو Touch ID أو Windows Hello أو مفتاح أمان لإكمال التسجيل.',
    'Go to login': 'الذهاب لتسجيل الدخول',
    'Creating account…': 'جارٍ إنشاء الحساب…',
    'Could not upload photo.': 'تعذّر رفع الصورة.',
    'Verifying…': 'جارٍ التحقق…',
    'Could not verify this device.': 'تعذّر التحقق من هذا الجهاز.',
    'Passwords do not match.': 'كلمتا المرور غير متطابقتين.',
    'Forgot password': 'نسيت كلمة المرور',
    'If an account exists for that email, a reset link has been sent.': 'إذا كان هناك حساب بهذا البريد، فقد أُرسل رابط إعادة التعيين.',
    'Send reset link': 'إرسال رابط إعادة التعيين',
    'Back to login': 'العودة لتسجيل الدخول',
    'Reset your password': 'أعد تعيين كلمة المرور',
    'Your password has been reset.': 'تمت إعادة تعيين كلمة المرور.',
    'New password': 'كلمة المرور الجديدة',
    'Reset password': 'إعادة تعيين كلمة المرور',
    'Verify your email': 'تحقق من بريدك الإلكتروني',
    'This link is invalid or has expired.': 'هذا الرابط غير صالح أو منتهي الصلاحية.',
    'Your email has been verified.': 'تم التحقق من بريدك الإلكتروني.',
    'Verify email': 'التحقق من البريد',

    // Buyer
    'Manage your requests for quotation, orders, and supplier activity.': 'أدِر طلبات التسعير والطلبات ونشاط الموردين.',
    'Create RFQ': 'إنشاء طلب تسعير',
    'Recent RFQs': 'أحدث طلبات التسعير',
    'View all': 'عرض الكل',
    'Recent orders': 'أحدث الطلبات',
    "Couldn't load your RFQs. Refresh to try again.": 'تعذّر تحميل طلبات التسعير. حدّث الصفحة وحاول مجددًا.',
    'No RFQs yet': 'لا توجد طلبات تسعير بعد',
    'No RFQs yet.': 'لا توجد طلبات تسعير بعد.',
    'Use': 'استخدم',
    'above to describe what you need to source — verified suppliers will send you competing offers.': 'بالأعلى لوصف ما تريد توريده — سيرسل لك الموردون الموثّقون عروضًا متنافسة.',
    'Quantity': 'الكمية',
    'Deadline': 'الموعد النهائي',
    'Created': 'تاريخ الإنشاء',
    'View →': 'عرض ←',
    "Couldn't load orders.": 'تعذّر تحميل الطلبات.',
    'No orders yet': 'لا توجد طلبات بعد',
    'No orders yet.': 'لا توجد طلبات بعد.',
    "Orders appear here once you accept a supplier's offer on one of your RFQs.": 'تظهر الطلبات هنا بعد قبولك عرض مورّد على أحد طلبات التسعير.',
    'Open RFQs': 'طلبات تسعير مفتوحة',
    'Total RFQs': 'إجمالي طلبات التسعير',
    'Active orders': 'طلبات نشطة',
    'Completed orders': 'طلبات مكتملة',
    'In progress': 'قيد التنفيذ',
    'All time': 'منذ البداية',
    'Unavailable': 'غير متاح',
    'Sample review': 'مراجعة العينة',
    'Approve sample': 'اعتماد العينة',
    'Reject sample': 'رفض العينة',
    'Rate this order': 'قيّم هذا الطلب',
    'Reorder': 'إعادة الطلب',
    'View tracking': 'عرض التتبع',
    'Rate order — Waradly': 'تقييم الطلب — Waradly',
    'Score (1–5)': 'التقييم (1–5)',
    'Comment (optional)': 'تعليق (اختياري)',
    'Submit rating': 'إرسال التقييم',
    'Order tracking — Waradly': 'تتبع الطلب — Waradly',
    'Order tracking': 'تتبع الطلب',
    'No history yet.': 'لا يوجد سجل بعد.',
    'Company Profile': 'ملف الشركة',
    'Legal name': 'الاسم القانوني',
    'Tax ID (optional)': 'الرقم الضريبي (اختياري)',
    'Exact address (internal use only)': 'العنوان التفصيلي (للاستخدام الداخلي فقط)',
    'Save changes': 'حفظ التغييرات',
    'Profile updated.': 'تم تحديث الملف.',
    'Category:': 'الفئة:',
    'Quantity:': 'الكمية:',
    'Delivery region:': 'منطقة التسليم:',
    'Delivery deadline:': 'موعد التسليم:',
    'Offer deadline:': 'آخر موعد للعروض:',
    'Rejection reason:': 'سبب الرفض:',
    'Items': 'البنود',
    'Item': 'البند',
    'Qty': 'الكمية',
    'Unit': 'الوحدة',
    'Edit': 'تعديل',
    'View offers': 'عرض العروض',
    'Cancel RFQ': 'إلغاء طلب التسعير',
    'Cancel this RFQ? This cannot be undone.': 'إلغاء طلب التسعير هذا؟ لا يمكن التراجع عن ذلك.',
    'e.g. Packaging': 'مثال: تغليف',
    'Item name': 'اسم البند',
    'Dimensions': 'الأبعاد',
    'Material': 'الخامة',
    'Printing / customization': 'الطباعة / التخصيص',
    'Delivery deadline': 'موعد التسليم',
    'Delivery region': 'منطقة التسليم',
    'Offer deadline': 'آخر موعد للعروض',
    'Quality requirements': 'متطلبات الجودة',
    'Certifications required': 'الشهادات المطلوبة',
    'Legal / compliance requirements': 'المتطلبات القانونية / الامتثال',
    'Sample required': 'العينة مطلوبة',
    'Add item': 'إضافة بند',
    'Save draft': 'حفظ كمسودة',
    'Submit for review': 'إرسال للمراجعة',
    'Remove': 'إزالة',
    'Edit RFQ': 'تعديل طلب التسعير',
    'Saved.': 'تم الحفظ.',
    'MOQ': 'الحد الأدنى للطلب',
    'Lead time': 'مدة التنفيذ',
    'Delivery est.': 'التسليم المتوقع',
    'Accept': 'قبول',
    'Accept this offer? This will reject all other offers and create an order.': 'قبول هذا العرض؟ سيتم رفض جميع العروض الأخرى وإنشاء طلب.',
    'My RFQs — Waradly': 'طلبات التسعير — Waradly',
    'Uncategorised': 'بدون فئة',

    // Supplier
    'Apply for the product categories you can supply. An admin reviews each application.': 'قدّم على فئات المنتجات التي يمكنك توريدها. يراجع المسؤول كل طلب.',
    'Submit an offer': 'تقديم عرض',
    'Unit price (EGP)': 'سعر الوحدة (ج.م)',
    'Production lead time (days)': 'مدة الإنتاج (بالأيام)',
    'Delivery estimate (days)': 'مدة التسليم المتوقعة (بالأيام)',
    'Sample available': 'تتوفر عينة',
    'Sample terms': 'شروط العينة',
    'Payment terms': 'شروط الدفع',
    'Technical specs notes': 'ملاحظات المواصفات الفنية',
    'Quality notes': 'ملاحظات الجودة',
    'Shipping estimate notes': 'ملاحظات تقدير الشحن',
    'Submit offer': 'تقديم العرض',
    'Edit offer': 'تعديل العرض',
    'Submitted': 'تاريخ التقديم',
    'Withdraw': 'سحب',
    'Withdraw this offer?': 'سحب هذا العرض؟',
    'Mark production started': 'تأكيد بدء الإنتاج',
    'Submit sample for review': 'إرسال العينة للمراجعة',
    'Mark production completed': 'تأكيد اكتمال الإنتاج',
    'Average rating': 'متوسط التقييم',
    'Anonymized ID': 'المعرّف المجهول',
    'Buyer:': 'المشتري:',
    'Quality requirements:': 'متطلبات الجودة:',
    'Region': 'المنطقة',
    'No RFQs available for your approved categories right now.': 'لا توجد طلبات تسعير متاحة لفئاتك المعتمدة حاليًا.',
    'Commercial registration': 'السجل التجاري',
    'Certificate': 'شهادة',
    'Other': 'أخرى',
    'Upload document': 'رفع مستند',
    'Document submitted for review.': 'تم إرسال المستند للمراجعة.',
    'Supplier organization ID': 'معرّف شركة المورّد',

    // Messages
    'Type a message…': 'اكتب رسالة…',
    'Send': 'إرسال',
    'No messages yet.': 'لا توجد رسائل بعد.',

    // Admin
    'entity_type (e.g. rfq)': 'نوع الكيان (مثال: rfq)',
    'actor_id': 'معرّف المنفّذ',
    'Filter': 'تصفية',
    'Action': 'الإجراء',
    'Entity': 'الكيان',
    'When': 'التوقيت',
    'No audit log entries match.': 'لا توجد سجلات مطابقة.',
    'New category name': 'اسم فئة جديدة',
    'Add': 'إضافة',
    'Name': 'الاسم',
    'Status': 'الحالة',
    'Activate': 'تفعيل',
    'Deactivate': 'إيقاف',
    'Delete': 'حذف',
    'No categories yet.': 'لا توجد فئات بعد.',
    'Delete this category?': 'حذف هذه الفئة؟',
    'Category': 'الفئة',
    'Description': 'الوصف',
    'Order': 'الطلب',
    'Reopen production': 'إعادة فتح الإنتاج',
    'Refund (manual)': 'استرداد (يدوي)',
    'Close, no action': 'إغلاق دون إجراء',
    'Resolve': 'حل',
    'No disputes.': 'لا توجد نزاعات.',
    'Orders by status': 'الطلبات حسب الحالة',
    'Count': 'العدد',
    'RFQs awaiting review': 'طلبات تسعير بانتظار المراجعة',
    'Pending supplier approvals': 'موردون بانتظار الاعتماد',
    'Flagged messages': 'رسائل مُبلّغ عنها',
    'Open disputes': 'نزاعات مفتوحة',
    'Manual escalation ladder: Warning → Strike → Suspension → Ban.': 'سلّم التصعيد اليدوي: تحذير ← مخالفة ← إيقاف ← حظر.',
    'Pattern': 'النمط',
    'Matched text': 'النص المطابق',
    'Conversation': 'المحادثة',
    'View': 'عرض',
    'Dismiss': 'تجاهل',
    'Warning': 'تحذير',
    'Strike': 'مخالفة',
    'Suspension': 'إيقاف',
    'Ban': 'حظر',
    'Apply': 'تطبيق',
    'No pending flags.': 'لا توجد بلاغات معلّقة.',
    'RFQ': 'طلب التسعير',
    'Unit price': 'سعر الوحدة',
    'Flag note': 'ملاحظة البلاغ',
    'Flag': 'إبلاغ',
    'No offers yet.': 'لا توجد عروض بعد.',
    'Force a status transition': 'فرض تغيير الحالة',
    'New status': 'الحالة الجديدة',
    'Reason (required)': 'السبب (مطلوب)',
    'Evidence file ID (required for hub/QC/delivered)': 'معرّف ملف الإثبات (مطلوب للمستودع/فحص الجودة/التسليم)',
    'Internal notes': 'ملاحظات داخلية',
    'Save notes': 'حفظ الملاحظات',
    'Buyer org:': 'شركة المشتري:',
    'Supplier org:': 'شركة المورّد:',
    'Sample required:': 'العينة مطلوبة:',
    'Confirm payment received': 'تأكيد استلام الدفع',
    'History': 'السجل',
    'Yes': 'نعم',
    'No': 'لا',
    'Upload new photo': 'رفع صورة جديدة',
    'Save username': 'حفظ اسم المستخدم',
    'Internal notes (never shown to buyer/supplier)': 'ملاحظات داخلية (لا تظهر أبدًا للمشتري أو المورّد)',
    'Distribution overrides': 'استثناءات التوزيع',
    "By default every supplier approved for this RFQ's category can see it. Override a specific supplier here.":
      'افتراضيًا يرى طلب التسعير كل مورّد معتمد في فئته. يمكنك استثناء مورّد محدد هنا.',
    'Include': 'تضمين',
    'Exclude': 'استبعاد',
    'Set': 'تعيين',
    'Supplier org': 'شركة المورّد',
    'Included': 'مُضمَّن',
    'No overrides set.': 'لا توجد استثناءات.',
    'Title': 'العنوان',
    'Approve': 'اعتماد',
    'Reject': 'رفض',
    'Nothing awaiting review.': 'لا شيء بانتظار المراجعة.',
    'Org': 'الشركة',
    'Document type': 'نوع المستند',
    'File': 'الملف',
    'No pending verifications.': 'لا توجد طلبات توثيق معلّقة.',
    'Role:': 'الدور:',
    'Status:': 'الحالة:',
    'Username:': 'اسم المستخدم:',
    'Failed login attempts:': 'محاولات الدخول الفاشلة:',
    'Created:': 'تاريخ الإنشاء:',
    'Organization': 'الشركة',
    'Legal name:': 'الاسم القانوني:',
    'Country / region:': 'الدولة / المنطقة:',
    'Back to users': 'العودة للمستخدمين',
    'Search email or username': 'ابحث بالبريد أو اسم المستخدم',
    'All roles': 'كل الأدوار',
    'Admin': 'مسؤول',
    'Reason': 'السبب',
    'Confirm': 'تأكيد',
    'Cancel': 'إلغاء',
    'Role': 'الدور',
    'Suspend': 'إيقاف',
    'Reactivate': 'إعادة تفعيل',
    'No users found.': 'لا يوجد مستخدمون.',
    'Suspend user': 'إيقاف المستخدم',
    'Ban user': 'حظر المستخدم',
    'No reason was recorded.': 'لم يُسجَّل سبب.',

    // Page titles not covered by the "X — Waradly" rule below
    'Admin Dashboard — Waradly': 'لوحة تحكم المسؤول — Waradly',
    'Order — Waradly': 'الطلب — Waradly',
    'RFQ — Waradly': 'طلب التسعير — Waradly',
    'RFQ Distribution — Waradly': 'توزيع طلب التسعير — Waradly',
    'User — Waradly': 'المستخدم — Waradly',
    'Offer — Waradly': 'العرض — Waradly',
    'Forgot password — Waradly': 'نسيت كلمة المرور — Waradly',
    'Reset password — Waradly': 'إعادة تعيين كلمة المرور — Waradly',
    'Verify email — Waradly': 'التحقق من البريد — Waradly',

    // Statuses shown in badges
    'DRAFT': 'مسودة',
    'SUBMITTED': 'مُرسَل',
    'UNDER_REVIEW': 'قيد المراجعة',
    'REJECTED': 'مرفوض',
    'PUBLISHED': 'منشور',
    'RECEIVING_OFFERS': 'يتلقى عروضًا',
    'EXPIRED': 'منتهي',
    'CANCELLED': 'ملغى',
    'AWARDED': 'تمت الترسية',
    'CLOSED': 'مغلق',
    'ACCEPTED': 'مقبول',
    'WITHDRAWN': 'مسحوب',
    'OFFER_SELECTED': 'تم اختيار العرض',
    'PENDING_PAYMENT': 'بانتظار الدفع',
    'PAYMENT_CONFIRMED': 'تم تأكيد الدفع',
    'PRODUCTION': 'قيد الإنتاج',
    'SAMPLE_REVIEW': 'مراجعة العينة',
    'PRODUCTION_COMPLETED': 'اكتمل الإنتاج',
    'RECEIVED_AT_HUB': 'استُلم في المستودع',
    'QC_COMPLETED': 'اكتمل فحص الجودة',
    'READY_FOR_DELIVERY': 'جاهز للتسليم',
    'IN_TRANSIT': 'قيد الشحن',
    'DELIVERED': 'تم التسليم',
    'COMPLETED': 'مكتمل',
    'DISPUTED': 'عليه نزاع',
    'RATED': 'تم التقييم',
    'pending': 'معلّق',
    'approved': 'معتمد',
    'verified': 'موثّق',
    'rejected': 'مرفوض',
    'active': 'نشط',
    'inactive': 'غير نشط',
    'suspended': 'موقوف',
    'banned': 'محظور',
    'buyer': 'مشترٍ',
    'supplier': 'مورّد',
    'admin': 'مسؤول',
    'open': 'مفتوح',
    'resolved': 'تم الحل',
    'dismissed': 'تم التجاهل',

    // Server messages (shown via showError / field errors)
    'Validation failed.': 'فشل التحقق من البيانات.',
    'Authentication required.': 'يجب تسجيل الدخول.',
    "You don't have access to this.": 'ليس لديك صلاحية الوصول.',
    'Not found.': 'غير موجود.',
    'Invalid email or password.': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'Too many failed attempts. Try again in 15 minutes.': 'محاولات فاشلة كثيرة. حاول مجددًا بعد 15 دقيقة.',
    'Please verify your email before logging in. Check your inbox for the verification link.': 'يرجى التحقق من بريدك الإلكتروني قبل تسجيل الدخول. ابحث عن رابط التحقق في بريدك الوارد.',
    'An account with this email already exists.': 'يوجد حساب بهذا البريد الإلكتروني بالفعل.',
    'Upload failed, please try again.': 'فشل الرفع، يرجى المحاولة مجددًا.',
    'Enter a valid email address.': 'أدخل بريدًا إلكترونيًا صالحًا.',
    'Password is required.': 'كلمة المرور مطلوبة.',
    'Password must be at least 8 characters.': 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
    'Password must contain at least one letter.': 'يجب أن تحتوي كلمة المرور على حرف واحد على الأقل.',
    'Password must contain at least one number.': 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل.',
    'Phone number is required.': 'رقم الهاتف مطلوب.',
    'Enter a valid phone number.': 'أدخل رقم هاتف صالحًا.',
    'Username is required.': 'اسم المستخدم مطلوب.',
    'Company legal name is required.': 'الاسم القانوني للشركة مطلوب.',
    'Country is required.': 'الدولة مطلوبة.',
    'General region is required.': 'المنطقة مطلوبة.',
    'You must confirm you are 18+ and accept the Terms, Anti-Circumvention Policy, and Privacy Policy.': 'يجب أن تؤكد أن عمرك 18 عامًا أو أكثر وأن توافق على الشروط وسياسة منع التحايل وسياسة الخصوصية.',
    'Title is required.': 'العنوان مطلوب.',
    'Title must be 150 characters or fewer.': 'يجب ألا يزيد العنوان عن 150 حرفًا.',
    'Category is required.': 'الفئة مطلوبة.',
    'Quantity is required.': 'الكمية مطلوبة.',
    'Category name is required.': 'اسم الفئة مطلوب.',
    'Message cannot be empty.': 'لا يمكن أن تكون الرسالة فارغة.',
    'A category with this name already exists.': 'توجد فئة بهذا الاسم بالفعل.',
    'This category is in use and cannot be deleted.': 'هذه الفئة مستخدمة ولا يمكن حذفها.',
    'A reason is required for admin-forced transitions.': 'السبب مطلوب عند فرض تغيير الحالة.',
    'A rejection reason is required.': 'سبب الرفض مطلوب.',
    'The offer deadline for this RFQ has passed.': 'انتهى آخر موعد لتقديم العروض على هذا الطلب.',
    'You already have an active offer on this RFQ.': 'لديك عرض نشط بالفعل على هذا الطلب.',
    'This RFQ can no longer be edited.': 'لم يعد بالإمكان تعديل طلب التسعير هذا.',
    'This RFQ has already been awarded.': 'تمت ترسية طلب التسعير هذا بالفعل.',
    'This RFQ cannot be awarded from its current status.': 'لا يمكن ترسية طلب التسعير في حالته الحالية.',
    'This RFQ cannot be cancelled from its current status.': 'لا يمكن إلغاء طلب التسعير في حالته الحالية.',
    'This RFQ cannot be submitted from its current status.': 'لا يمكن إرسال طلب التسعير في حالته الحالية.',
    'This RFQ cannot be published from its current status.': 'لا يمكن نشر طلب التسعير في حالته الحالية.',
    'This RFQ cannot be rejected from its current status.': 'لا يمكن رفض طلب التسعير في حالته الحالية.',
    'This offer can no longer be edited.': 'لم يعد بالإمكان تعديل هذا العرض.',
    'This offer cannot be withdrawn from its current status.': 'لا يمكن سحب هذا العرض في حالته الحالية.',
    'This offer is no longer available, please refresh.': 'هذا العرض لم يعد متاحًا، يرجى تحديث الصفحة.',
    'This order cannot be rated yet.': 'لا يمكن تقييم هذا الطلب بعد.',
    'This order has already been rated.': 'تم تقييم هذا الطلب بالفعل.',
    'Only completed orders can be reordered.': 'يمكن إعادة طلب الطلبات المكتملة فقط.',
    'This order is already under dispute.': 'هذا الطلب عليه نزاع بالفعل.',
    'This dispute is already resolved.': 'تم حل هذا النزاع بالفعل.',
    'This order is not awaiting a sample decision.': 'هذا الطلب لا ينتظر قرارًا بشأن العينة.',
    'This order is not awaiting a sample submission.': 'هذا الطلب لا ينتظر إرسال عينة.',
    'This order is not awaiting payment confirmation.': 'هذا الطلب لا ينتظر تأكيد الدفع.',
    'This order cannot start production from its current status.': 'لا يمكن بدء الإنتاج في حالة الطلب الحالية.',
    'This order cannot be marked complete from its current status.': 'لا يمكن تأكيد اكتمال الطلب في حالته الحالية.',
    'This order requires sample approval before production can be marked complete.': 'يتطلب هذا الطلب اعتماد العينة قبل تأكيد اكتمال الإنتاج.',
    'This transition is not allowed from the current status.': 'هذا التغيير غير مسموح من الحالة الحالية.',
    'You have already applied for this category.': 'لقد قدّمت على هذه الفئة بالفعل.',
    'File not found, or not uploaded by you.': 'الملف غير موجود أو لم تقم برفعه.',
    'One or more attachments were not uploaded by you.': 'مرفق واحد أو أكثر لم تقم برفعه.',
    'This image could not be processed.': 'تعذّرت معالجة هذه الصورة.',
    'File content does not match its declared type.': 'محتوى الملف لا يطابق نوعه المعلن.',
  };

  const STATUS_VERB = { suspended: 'إيقاف', banned: 'حظر' };
  const PATTERNS = [
    [/^(.+) — Waradly$/, (m, x) => `${AR[x] || x} — Waradly`],
    [/^Order (\S+)$/, 'الطلب $1'],
    [/^(\d+) receiving offers$/, '$1 تتلقى عروضًا'],
    [/^(\d+) in draft$/, '$1 مسودة'],
    [/^(\d+) disputed$/, '$1 عليها نزاع'],
    [/^Showing the latest (\d+) orders\.$/, 'عرض أحدث $1 طلب.'],
    [/^([\d.,]+) EGP$/, '$1 ج.م'],
    [/^([\d.,]+) EGP\/pc$/, '$1 ج.م/قطعة'],
    [/^(\d+)d$/, '$1 يوم'],
    [/^(.+) · flagged for review$/, '$1 · أُبلغ عنها للمراجعة'],
    [/^Your account has been (\w+)\. Please contact support\.$/, (m, s) => `تم ${STATUS_VERB[s] || s} حسابك. يرجى التواصل مع الدعم.`],
  ];

  function tr(text) {
    const parts = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const key = parts[2].replace(/\s+/g, ' ');
    if (!key) return text;
    let out = AR[key];
    if (out === undefined && /^[A-Z][a-z ]+$/.test(key)) out = AR[key.toUpperCase().replace(/ /g, '_')]; // "Pending payment" → PENDING_PAYMENT
    if (out === undefined) {
      const hit = PATTERNS.find(([re]) => re.test(key));
      if (hit) out = key.replace(hit[0], hit[1]);
    }
    return out === undefined ? text : parts[1] + out + parts[3];
  }

  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);

  function translateAttrs(el) {
    for (const name of ATTRS) {
      const value = el.getAttribute(name);
      if (value) {
        const next = tr(value);
        if (next !== value) el.setAttribute(name, next);
      }
    }
  }

  function translate(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentNode && SKIP.has(node.parentNode.nodeName)) return;
      const next = tr(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has(node.nodeName) || node.isContentEditable) return;
    translateAttrs(node);
    node.childNodes.forEach(translate);
  }

  window.waradlyI18n.translate = translate;

  for (const name of ['alert', 'confirm', 'prompt']) {
    const original = window[name].bind(window);
    window[name] = (message, ...rest) => original(typeof message === 'string' ? tr(message) : message, ...rest);
  }

  // Translates parser-inserted nodes as the page loads, and anything page scripts render later.
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') translateAttrs(m.target);
      else if (m.type === 'characterData') translate(m.target);
      else m.addedNodes.forEach(translate);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  document.addEventListener('DOMContentLoaded', () => {
    translate(document.documentElement); // catch-all for anything the observer missed
    addToggle();
  });
})();
