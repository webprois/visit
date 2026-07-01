import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n"

/**
 * UI translation dictionaries. English is the source of truth; every other
 * locale mirrors the same shape. Add new user-facing strings here (never
 * hardcode them in components) so they can be translated across all locales.
 *
 * Placeholders use `{name}` tokens and are filled with the `fmt()` helper.
 */
const en = {
  nav: {
    allTours: "All Tours",
    transfers: "Transfers",
    whyUs: "Why Us",
    menu: "Menu",
  },
  hero: {
    badge: "Trusted by 500+ travellers",
    title: "Ready for adventure in the land of fire and ice?",
    subtitle:
      "Explore over 70 handpicked tours across Iceland — from glacier hikes and northern lights to the Golden Circle. Let's create unforgettable memories together.",
    exploreTours: "Explore Tours",
    privateTrip: "Plan a Private Trip",
  },
  search: {
    experienceLabel: "Choose your perfect Icelandic experience",
    experiencePlaceholder: "Choose an experience",
    anyExperience: "Any experience",
    experiencesSelected: "{count} experiences",
    datesLabel: "Select dates",
    datesPlaceholder: "Starting date — Final date",
    travelersLabel: "Add travelers",
    traveler: "{count} traveler",
    travelers: "{count} travelers",
    adults: "Adults",
    children: "Children",
    searchNow: "Search Now",
  },
  categories: {
    eyebrow: "Choose your activity",
    title: "Explore Iceland by adventure",
    subtitle:
      "Browse our most popular categories and dive into unforgettable experiences across the whole island.",
    tour: "{count} tour",
    tours: "{count} tours",
  },
  featured: {
    eyebrow: "Discover our tours",
    title: "Handpicked adventures",
    viewAll: "View all tours",
    from: "From",
    viewTour: "View tour",
  },
  why: {
    title: "Why book with us?",
    subtitle:
      "We organise private tours that aren't available as standard options — tailor-made to the needs and wishes of every client.",
    pickedTitle: "Carefully picked",
    pickedText: "Every tour and activity is handpicked by our travel professionals.",
    valueTitle: "Great value",
    valueText: "A trusted blend of fair pricing and genuine quality service.",
    serviceTitle: "Personal service",
    serviceText: "Tailor-made private tours designed around your wishes.",
    trustedTitle: "Trusted by 500+",
    trustedText: "Hundreds of happy travellers have explored Iceland with us.",
  },
  transfers: {
    eyebrow: "Services & Transportation",
    title: "Get from point A to B. Hassle free.",
    subtitle:
      "Whether you need swift airport transfers, a convenient ride to the Blue Lagoon, or a journey from your hotel to key destinations, we've got you covered with reliable service across Iceland.",
    seeAll: "See all transfers",
    max: "Max {count}",
  },
  reviews: {
    eyebrow: "What travellers say",
    title: "Reviews from Google",
    count: "{count} Google reviews",
    readAll: "Read all reviews on Google",
  },
  footer: {
    ctaTitle: "Start your Icelandic adventure today",
    ctaSubtitle: "Questions? We're here to help you plan the perfect trip.",
    browseTours: "Browse tours",
    contactUs: "Contact us",
    tagline:
      "Your gateway to extraordinary adventures in the land of fire and ice.",
    toursTitle: "Tours",
    dayTours: "Day Tours",
    multiDayTours: "Multi-Day Tours",
    privateTours: "Private Tours",
    selfDrive: "Self Drive",
    companyTitle: "Company",
    aboutUs: "About Us",
    whyBook: "Why Book With Us",
    reviews: "Reviews",
    contact: "Contact",
    getInTouch: "Get in touch",
    rights: "Tours & Travel. All rights reserved.",
    privacy: "Privacy",
    terms: "Terms",
  },
  browser: {
    searchPlaceholder: "Search by tour, location or category…",
    searchAria: "Search tours",
    filters: "Filters",
    clearAll: "Clear all",
    clearAllFilters: "Clear all filters",
    travelDates: "Travel dates",
    datesPlaceholder: "Starting date — Final date",
    clearDates: "Clear dates",
    travelers: "Travelers",
    duration: "Duration",
    dayTour: "Day tour",
    days: "{count} days",
    difficulty: "Difficulty",
    price: "Price",
    minPrice: "Min price",
    maxPrice: "Max price",
    activities: "Activities",
    searchActivities: "Search activities",
    startingLocation: "Starting location",
    searchLocations: "Search locations",
    noMatches: "No matches",
    searchShort: "Search…",
    resultTour: "{count} tour",
    resultTours: "{count} tours",
    noToursTitle: "No tours found",
    noToursText: "Try adjusting or clearing your filters.",
    from: "From",
    viewTour: "View tour",
    adults: "Adults",
    children: "Children",
    traveler: "{count} traveler",
    travelers2: "{count} travelers",
  },
  toursLoading: {
    checking: "Checking live availability…",
  },
}

export type Dictionary = typeof en

/** Spanish */
const es: Dictionary = {
  nav: {
    allTours: "Todos los tours",
    transfers: "Traslados",
    whyUs: "Por qué nosotros",
    menu: "Menú",
  },
  hero: {
    badge: "Con la confianza de más de 500 viajeros",
    title: "¿Listo para la aventura en la tierra del fuego y el hielo?",
    subtitle:
      "Explora más de 70 tours seleccionados por toda Islandia: desde caminatas por glaciares y auroras boreales hasta el Círculo Dorado. Creemos recuerdos inolvidables juntos.",
    exploreTours: "Explorar tours",
    privateTrip: "Planear un viaje privado",
  },
  search: {
    experienceLabel: "Elige tu experiencia islandesa perfecta",
    experiencePlaceholder: "Elige una experiencia",
    anyExperience: "Cualquier experiencia",
    experiencesSelected: "{count} experiencias",
    datesLabel: "Selecciona fechas",
    datesPlaceholder: "Fecha de inicio — Fecha final",
    travelersLabel: "Añadir viajeros",
    traveler: "{count} viajero",
    travelers: "{count} viajeros",
    adults: "Adultos",
    children: "Niños",
    searchNow: "Buscar ahora",
  },
  categories: {
    eyebrow: "Elige tu actividad",
    title: "Explora Islandia por aventura",
    subtitle:
      "Descubre nuestras categorías más populares y sumérgete en experiencias inolvidables por toda la isla.",
    tour: "{count} tour",
    tours: "{count} tours",
  },
  featured: {
    eyebrow: "Descubre nuestros tours",
    title: "Aventuras seleccionadas",
    viewAll: "Ver todos los tours",
    from: "Desde",
    viewTour: "Ver tour",
  },
  why: {
    title: "¿Por qué reservar con nosotros?",
    subtitle:
      "Organizamos tours privados que no están disponibles como opciones estándar, hechos a medida según las necesidades y deseos de cada cliente.",
    pickedTitle: "Cuidadosamente seleccionados",
    pickedText:
      "Cada tour y actividad es elegido por nuestros profesionales de viajes.",
    valueTitle: "Gran valor",
    valueText:
      "Una combinación de confianza entre precios justos y un servicio de calidad genuina.",
    serviceTitle: "Servicio personal",
    serviceText: "Tours privados a medida diseñados según tus deseos.",
    trustedTitle: "Más de 500 confían en nosotros",
    trustedText:
      "Cientos de viajeros felices han explorado Islandia con nosotros.",
  },
  transfers: {
    eyebrow: "Servicios y transporte",
    title: "Ve del punto A al B. Sin complicaciones.",
    subtitle:
      "Ya sea que necesites traslados rápidos al aeropuerto, un cómodo viaje a la Laguna Azul o un trayecto desde tu hotel a destinos clave, te cubrimos con un servicio fiable por toda Islandia.",
    seeAll: "Ver todos los traslados",
    max: "Máx {count}",
  },
  reviews: {
    eyebrow: "Lo que dicen los viajeros",
    title: "Reseñas de Google",
    count: "{count} reseñas de Google",
    readAll: "Leer todas las reseñas en Google",
  },
  footer: {
    ctaTitle: "Comienza tu aventura islandesa hoy",
    ctaSubtitle:
      "¿Preguntas? Estamos aquí para ayudarte a planear el viaje perfecto.",
    browseTours: "Ver tours",
    contactUs: "Contáctanos",
    tagline:
      "Tu puerta de entrada a aventuras extraordinarias en la tierra del fuego y el hielo.",
    toursTitle: "Tours",
    dayTours: "Tours de un día",
    multiDayTours: "Tours de varios días",
    privateTours: "Tours privados",
    selfDrive: "Autoconducido",
    companyTitle: "Empresa",
    aboutUs: "Sobre nosotros",
    whyBook: "Por qué reservar con nosotros",
    reviews: "Reseñas",
    contact: "Contacto",
    getInTouch: "Ponte en contacto",
    rights: "Tours y viajes. Todos los derechos reservados.",
    privacy: "Privacidad",
    terms: "Términos",
  },
  browser: {
    searchPlaceholder: "Busca por tour, lugar o categoría…",
    searchAria: "Buscar tours",
    filters: "Filtros",
    clearAll: "Borrar todo",
    clearAllFilters: "Borrar todos los filtros",
    travelDates: "Fechas de viaje",
    datesPlaceholder: "Fecha de inicio — Fecha final",
    clearDates: "Borrar fechas",
    travelers: "Viajeros",
    duration: "Duración",
    dayTour: "Tour de un día",
    days: "{count} días",
    difficulty: "Dificultad",
    price: "Precio",
    minPrice: "Precio mín",
    maxPrice: "Precio máx",
    activities: "Actividades",
    searchActivities: "Buscar actividades",
    startingLocation: "Punto de salida",
    searchLocations: "Buscar lugares",
    noMatches: "Sin resultados",
    searchShort: "Buscar…",
    resultTour: "{count} tour",
    resultTours: "{count} tours",
    noToursTitle: "No se encontraron tours",
    noToursText: "Intenta ajustar o borrar tus filtros.",
    from: "Desde",
    viewTour: "Ver tour",
    adults: "Adultos",
    children: "Niños",
    traveler: "{count} viajero",
    travelers2: "{count} viajeros",
  },
  toursLoading: {
    checking: "Comprobando disponibilidad en vivo…",
  },
}

/** Portuguese */
const pt: Dictionary = {
  nav: {
    allTours: "Todos os tours",
    transfers: "Traslados",
    whyUs: "Por que nós",
    menu: "Menu",
  },
  hero: {
    badge: "Com a confiança de mais de 500 viajantes",
    title: "Pronto para a aventura na terra do fogo e do gelo?",
    subtitle:
      "Explore mais de 70 tours selecionados por toda a Islândia — de caminhadas em geleiras e auroras boreais ao Círculo Dourado. Vamos criar memórias inesquecíveis juntos.",
    exploreTours: "Explorar tours",
    privateTrip: "Planear uma viagem privada",
  },
  search: {
    experienceLabel: "Escolha a sua experiência islandesa perfeita",
    experiencePlaceholder: "Escolha uma experiência",
    anyExperience: "Qualquer experiência",
    experiencesSelected: "{count} experiências",
    datesLabel: "Selecione as datas",
    datesPlaceholder: "Data de início — Data final",
    travelersLabel: "Adicionar viajantes",
    traveler: "{count} viajante",
    travelers: "{count} viajantes",
    adults: "Adultos",
    children: "Crianças",
    searchNow: "Pesquisar agora",
  },
  categories: {
    eyebrow: "Escolha a sua atividade",
    title: "Explore a Islândia por aventura",
    subtitle:
      "Navegue pelas nossas categorias mais populares e mergulhe em experiências inesquecíveis por toda a ilha.",
    tour: "{count} tour",
    tours: "{count} tours",
  },
  featured: {
    eyebrow: "Descubra os nossos tours",
    title: "Aventuras selecionadas",
    viewAll: "Ver todos os tours",
    from: "A partir de",
    viewTour: "Ver tour",
  },
  why: {
    title: "Porquê reservar connosco?",
    subtitle:
      "Organizamos tours privados que não estão disponíveis como opções padrão — feitos à medida das necessidades e desejos de cada cliente.",
    pickedTitle: "Cuidadosamente selecionados",
    pickedText:
      "Cada tour e atividade é escolhido pelos nossos profissionais de viagens.",
    valueTitle: "Ótimo valor",
    valueText:
      "Uma combinação de confiança entre preços justos e um serviço de qualidade genuína.",
    serviceTitle: "Serviço personalizado",
    serviceText: "Tours privados feitos à medida dos seus desejos.",
    trustedTitle: "Mais de 500 confiam em nós",
    trustedText:
      "Centenas de viajantes felizes exploraram a Islândia connosco.",
  },
  transfers: {
    eyebrow: "Serviços e transporte",
    title: "Vá do ponto A ao B. Sem complicações.",
    subtitle:
      "Quer precise de traslados rápidos do aeroporto, uma viagem confortável até à Lagoa Azul ou um percurso do seu hotel a destinos importantes, temos tudo tratado com um serviço fiável por toda a Islândia.",
    seeAll: "Ver todos os traslados",
    max: "Máx {count}",
  },
  reviews: {
    eyebrow: "O que dizem os viajantes",
    title: "Avaliações do Google",
    count: "{count} avaliações do Google",
    readAll: "Ler todas as avaliações no Google",
  },
  footer: {
    ctaTitle: "Comece a sua aventura islandesa hoje",
    ctaSubtitle:
      "Perguntas? Estamos aqui para o ajudar a planear a viagem perfeita.",
    browseTours: "Ver tours",
    contactUs: "Contacte-nos",
    tagline:
      "A sua porta de entrada para aventuras extraordinárias na terra do fogo e do gelo.",
    toursTitle: "Tours",
    dayTours: "Tours de um dia",
    multiDayTours: "Tours de vários dias",
    privateTours: "Tours privados",
    selfDrive: "Autocondução",
    companyTitle: "Empresa",
    aboutUs: "Sobre nós",
    whyBook: "Porquê reservar connosco",
    reviews: "Avaliações",
    contact: "Contacto",
    getInTouch: "Entre em contacto",
    rights: "Tours e viagens. Todos os direitos reservados.",
    privacy: "Privacidade",
    terms: "Termos",
  },
  browser: {
    searchPlaceholder: "Pesquise por tour, local ou categoria…",
    searchAria: "Pesquisar tours",
    filters: "Filtros",
    clearAll: "Limpar tudo",
    clearAllFilters: "Limpar todos os filtros",
    travelDates: "Datas de viagem",
    datesPlaceholder: "Data de início — Data final",
    clearDates: "Limpar datas",
    travelers: "Viajantes",
    duration: "Duração",
    dayTour: "Tour de um dia",
    days: "{count} dias",
    difficulty: "Dificuldade",
    price: "Preço",
    minPrice: "Preço mín",
    maxPrice: "Preço máx",
    activities: "Atividades",
    searchActivities: "Pesquisar atividades",
    startingLocation: "Ponto de partida",
    searchLocations: "Pesquisar locais",
    noMatches: "Sem resultados",
    searchShort: "Pesquisar…",
    resultTour: "{count} tour",
    resultTours: "{count} tours",
    noToursTitle: "Nenhum tour encontrado",
    noToursText: "Tente ajustar ou limpar os seus filtros.",
    from: "A partir de",
    viewTour: "Ver tour",
    adults: "Adultos",
    children: "Crianças",
    traveler: "{count} viajante",
    travelers2: "{count} viajantes",
  },
  toursLoading: {
    checking: "A verificar disponibilidade em tempo real…",
  },
}

/** Italian */
const it: Dictionary = {
  nav: {
    allTours: "Tutti i tour",
    transfers: "Transfer",
    whyUs: "Perché noi",
    menu: "Menu",
  },
  hero: {
    badge: "Scelto da oltre 500 viaggiatori",
    title: "Pronto per l'avventura nella terra del fuoco e del ghiaccio?",
    subtitle:
      "Esplora oltre 70 tour selezionati in tutta l'Islanda — dalle escursioni sui ghiacciai e l'aurora boreale al Circolo d'Oro. Creiamo insieme ricordi indimenticabili.",
    exploreTours: "Esplora i tour",
    privateTrip: "Pianifica un viaggio privato",
  },
  search: {
    experienceLabel: "Scegli la tua esperienza islandese perfetta",
    experiencePlaceholder: "Scegli un'esperienza",
    anyExperience: "Qualsiasi esperienza",
    experiencesSelected: "{count} esperienze",
    datesLabel: "Seleziona le date",
    datesPlaceholder: "Data di inizio — Data finale",
    travelersLabel: "Aggiungi viaggiatori",
    traveler: "{count} viaggiatore",
    travelers: "{count} viaggiatori",
    adults: "Adulti",
    children: "Bambini",
    searchNow: "Cerca ora",
  },
  categories: {
    eyebrow: "Scegli la tua attività",
    title: "Esplora l'Islanda per avventura",
    subtitle:
      "Sfoglia le nostre categorie più popolari e immergiti in esperienze indimenticabili in tutta l'isola.",
    tour: "{count} tour",
    tours: "{count} tour",
  },
  featured: {
    eyebrow: "Scopri i nostri tour",
    title: "Avventure selezionate",
    viewAll: "Vedi tutti i tour",
    from: "Da",
    viewTour: "Vedi il tour",
  },
  why: {
    title: "Perché prenotare con noi?",
    subtitle:
      "Organizziamo tour privati che non sono disponibili come opzioni standard — su misura per le esigenze e i desideri di ogni cliente.",
    pickedTitle: "Selezionati con cura",
    pickedText:
      "Ogni tour e attività è scelto dai nostri professionisti dei viaggi.",
    valueTitle: "Ottimo valore",
    valueText:
      "Un mix affidabile di prezzi equi e servizio di qualità autentica.",
    serviceTitle: "Servizio personale",
    serviceText: "Tour privati su misura, progettati secondo i tuoi desideri.",
    trustedTitle: "Scelto da oltre 500",
    trustedText:
      "Centinaia di viaggiatori felici hanno esplorato l'Islanda con noi.",
  },
  transfers: {
    eyebrow: "Servizi e trasporti",
    title: "Vai dal punto A al B. Senza pensieri.",
    subtitle:
      "Che tu abbia bisogno di transfer rapidi dall'aeroporto, un comodo passaggio alla Laguna Blu o un tragitto dal tuo hotel a destinazioni chiave, ti copriamo con un servizio affidabile in tutta l'Islanda.",
    seeAll: "Vedi tutti i transfer",
    max: "Max {count}",
  },
  reviews: {
    eyebrow: "Cosa dicono i viaggiatori",
    title: "Recensioni da Google",
    count: "{count} recensioni Google",
    readAll: "Leggi tutte le recensioni su Google",
  },
  footer: {
    ctaTitle: "Inizia oggi la tua avventura islandese",
    ctaSubtitle:
      "Domande? Siamo qui per aiutarti a pianificare il viaggio perfetto.",
    browseTours: "Sfoglia i tour",
    contactUs: "Contattaci",
    tagline:
      "La tua porta d'accesso ad avventure straordinarie nella terra del fuoco e del ghiaccio.",
    toursTitle: "Tour",
    dayTours: "Tour giornalieri",
    multiDayTours: "Tour di più giorni",
    privateTours: "Tour privati",
    selfDrive: "Self drive",
    companyTitle: "Azienda",
    aboutUs: "Chi siamo",
    whyBook: "Perché prenotare con noi",
    reviews: "Recensioni",
    contact: "Contatto",
    getInTouch: "Mettiti in contatto",
    rights: "Tour e viaggi. Tutti i diritti riservati.",
    privacy: "Privacy",
    terms: "Termini",
  },
  browser: {
    searchPlaceholder: "Cerca per tour, luogo o categoria…",
    searchAria: "Cerca tour",
    filters: "Filtri",
    clearAll: "Cancella tutto",
    clearAllFilters: "Cancella tutti i filtri",
    travelDates: "Date di viaggio",
    datesPlaceholder: "Data di inizio — Data finale",
    clearDates: "Cancella date",
    travelers: "Viaggiatori",
    duration: "Durata",
    dayTour: "Tour giornaliero",
    days: "{count} giorni",
    difficulty: "Difficoltà",
    price: "Prezzo",
    minPrice: "Prezzo min",
    maxPrice: "Prezzo max",
    activities: "Attività",
    searchActivities: "Cerca attività",
    startingLocation: "Punto di partenza",
    searchLocations: "Cerca luoghi",
    noMatches: "Nessun risultato",
    searchShort: "Cerca…",
    resultTour: "{count} tour",
    resultTours: "{count} tour",
    noToursTitle: "Nessun tour trovato",
    noToursText: "Prova a modificare o cancellare i filtri.",
    from: "Da",
    viewTour: "Vedi il tour",
    adults: "Adulti",
    children: "Bambini",
    traveler: "{count} viaggiatore",
    travelers2: "{count} viaggiatori",
  },
  toursLoading: {
    checking: "Verifica della disponibilità in tempo reale…",
  },
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, es, pt, it }

/** Return the full UI dictionary for a locale (falls back to English). */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
}

/** Fill `{name}` placeholders in a translated string. */
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}
