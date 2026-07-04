import { type Locale, DEFAULT_LOCALE, asLocale } from "@/lib/i18n"

/**
 * Localized copy for transactional emails, kept separate from the large UI
 * dictionary in lib/translations.ts. Every locale mirrors the English shape.
 *
 * `{token}` placeholders are filled with `fmtEmail()`.
 */

export type EmailStrings = {
  brand: string
  // Shared
  hi: string // "Hi {name},"
  tourLabel: string
  dateLabel: string
  guestsLabel: string
  bookingRefLabel: string
  questionsHtml: string // may contain a mailto link
  footerRights: string
  // Confirmation
  confirmSubject: string // "Your booking is confirmed – {tour}"
  confirmHeading: string
  confirmIntro: string
  voucherHeading: string
  voucherText: string
  voucherButton: string
  confirmOutro: string
  // Reminder (week + day share strings, differ by {when})
  reminderSubjectWeek: string
  reminderSubjectDay: string
  reminderHeadingWeek: string
  reminderHeadingDay: string
  reminderIntroWeek: string
  reminderIntroDay: string
  reminderVoucherText: string
  reminderChecklist: string
  reminderCancelNote: string // links to My account
  reminderButton: string
  // Cancellation confirmation
  cancelSubject: string
  cancelHeading: string
  cancelIntro: string
  cancelRefund: string
  cancelOutro: string
  // Cancellation request received (under 72h)
  cancelReqSubject: string
  cancelReqHeading: string
  cancelReqIntro: string
  cancelReqOutro: string
  // Cancellation request approved by staff (under 72h)
  cancelApprovedSubject: string
  cancelApprovedHeading: string
  cancelApprovedIntro: string
  cancelApprovedOutro: string
  // Cancellation request declined by staff
  cancelDeclinedSubject: string
  cancelDeclinedHeading: string
  cancelDeclinedIntro: string
  cancelDeclinedOutro: string
  // Optional staff note shown in resolution emails
  adminNoteLabel: string
}

const en: EmailStrings = {
  brand: "Visit Iceland",
  hi: "Hi {name},",
  tourLabel: "Tour",
  dateLabel: "Date",
  guestsLabel: "Guests",
  bookingRefLabel: "Booking reference",
  questionsHtml:
    'Questions? Just reply to this email or contact us at <a href="mailto:info@visit.is">info@visit.is</a>.',
  footerRights: "All rights reserved.",
  confirmSubject: "Your booking is confirmed – {tour}",
  confirmHeading: "Your adventure is booked!",
  confirmIntro:
    "Thank you for booking with us. Your tour is confirmed and we can't wait to welcome you. Here are your details:",
  voucherHeading: "Your voucher",
  voucherText:
    "Please download your voucher and have it ready (on your phone or printed) on the day of your tour.",
  voucherButton: "Download voucher",
  confirmOutro:
    "Please arrive a few minutes early. If anything changes, you can manage your booking from your account.",
  reminderSubjectWeek: "See you in a week – {tour}",
  reminderSubjectDay: "Your tour is tomorrow – {tour}",
  reminderHeadingWeek: "Your tour is coming up",
  reminderHeadingDay: "Your tour is tomorrow!",
  reminderIntroWeek:
    "Just a friendly reminder that your tour is one week away. Here are the details:",
  reminderIntroDay:
    "We're looking forward to seeing you tomorrow! Here are the details:",
  reminderVoucherText:
    "Have your voucher ready (on your phone or printed) when you arrive.",
  reminderChecklist:
    "Dress warmly and in layers, bring waterproofs, and wear sturdy shoes — Icelandic weather changes fast.",
  reminderCancelNote:
    "Can't make it? You can cancel from your account, subject to our cancellation policy.",
  reminderButton: "Download voucher",
  cancelSubject: "Your booking has been cancelled – {tour}",
  cancelHeading: "Your booking is cancelled",
  cancelIntro:
    "As requested, we've cancelled the following booking:",
  cancelRefund:
    "Because you cancelled more than 72 hours before departure, your booking is fully refunded per our cancellation policy. Refunds are processed to your original payment method.",
  cancelOutro:
    "We're sorry we won't see you this time and hope to welcome you on another adventure soon.",
  cancelReqSubject: "We've received your cancellation request – {tour}",
  cancelReqHeading: "Cancellation request received",
  cancelReqIntro:
    "We've received your request to cancel the following booking. Because it's within 72 hours of departure, our team will review it against our cancellation policy and get back to you shortly:",
  cancelReqOutro:
    "You don't need to do anything else for now — we'll email you once your request has been reviewed.",
  cancelApprovedSubject: "Your cancellation is confirmed – {tour}",
  cancelApprovedHeading: "Your cancellation is approved",
  cancelApprovedIntro:
    "We've reviewed your request and cancelled the following booking:",
  cancelApprovedOutro:
    "Any refund due will be processed to your original payment method according to our cancellation policy. We hope to welcome you on another adventure soon.",
  cancelDeclinedSubject: "Update on your cancellation request – {tour}",
  cancelDeclinedHeading: "About your cancellation request",
  cancelDeclinedIntro:
    "We've reviewed your request to cancel the following booking. Unfortunately, we're unable to cancel it under our cancellation policy, so your booking still stands:",
  cancelDeclinedOutro:
    "If you have any questions, just reply to this email and our team will be happy to help.",
  adminNoteLabel: "Note from our team",
}

const es: EmailStrings = {
  brand: "Visit Iceland",
  hi: "Hola {name}:",
  tourLabel: "Tour",
  dateLabel: "Fecha",
  guestsLabel: "Viajeros",
  bookingRefLabel: "Referencia de reserva",
  questionsHtml:
    '¿Preguntas? Responde a este correo o escríbenos a <a href="mailto:info@visit.is">info@visit.is</a>.',
  footerRights: "Todos los derechos reservados.",
  confirmSubject: "Tu reserva está confirmada – {tour}",
  confirmHeading: "¡Tu aventura está reservada!",
  confirmIntro:
    "Gracias por reservar con nosotros. Tu tour está confirmado y estamos deseando recibirte. Estos son tus datos:",
  voucherHeading: "Tu bono (voucher)",
  voucherText:
    "Descarga tu bono y tenlo listo (en el móvil o impreso) el día de tu tour.",
  voucherButton: "Descargar bono",
  confirmOutro:
    "Llega unos minutos antes. Si algo cambia, puedes gestionar tu reserva desde tu cuenta.",
  reminderSubjectWeek: "Nos vemos en una semana – {tour}",
  reminderSubjectDay: "Tu tour es mañana – {tour}",
  reminderHeadingWeek: "Tu tour se acerca",
  reminderHeadingDay: "¡Tu tour es mañana!",
  reminderIntroWeek:
    "Un recordatorio de que tu tour es dentro de una semana. Estos son los datos:",
  reminderIntroDay:
    "¡Tenemos muchas ganas de verte mañana! Estos son los datos:",
  reminderVoucherText:
    "Ten tu bono listo (en el móvil o impreso) cuando llegues.",
  reminderChecklist:
    "Abrígate por capas, lleva ropa impermeable y calzado resistente: el tiempo en Islandia cambia rápido.",
  reminderCancelNote:
    "¿No puedes asistir? Puedes cancelar desde tu cuenta, según nuestra política de cancelación.",
  reminderButton: "Descargar bono",
  cancelSubject: "Tu reserva ha sido cancelada – {tour}",
  cancelHeading: "Tu reserva está cancelada",
  cancelIntro: "Según tu solicitud, hemos cancelado la siguiente reserva:",
  cancelRefund:
    "Como cancelaste con más de 72 horas de antelación, tu reserva se reembolsa íntegramente según nuestra política de cancelación. Los reembolsos se procesan al método de pago original.",
  cancelOutro:
    "Sentimos no verte esta vez y esperamos recibirte pronto en otra aventura.",
  cancelReqSubject: "Hemos recibido tu solicitud de cancelación – {tour}",
  cancelReqHeading: "Solicitud de cancelación recibida",
  cancelReqIntro:
    "Hemos recibido tu solicitud para cancelar la siguiente reserva. Como faltan menos de 72 horas para la salida, nuestro equipo la revisará según nuestra política de cancelación y te responderá en breve:",
  cancelReqOutro:
    "Por ahora no tienes que hacer nada más: te escribiremos en cuanto se revise tu solicitud.",
  cancelApprovedSubject: "Tu cancelación está confirmada – {tour}",
  cancelApprovedHeading: "Tu cancelación está aprobada",
  cancelApprovedIntro:
    "Hemos revisado tu solicitud y cancelado la siguiente reserva:",
  cancelApprovedOutro:
    "Cualquier reembolso correspondiente se procesará a tu método de pago original según nuestra política de cancelación. Esperamos recibirte pronto en otra aventura.",
  cancelDeclinedSubject: "Actualización sobre tu solicitud de cancelación – {tour}",
  cancelDeclinedHeading: "Sobre tu solicitud de cancelación",
  cancelDeclinedIntro:
    "Hemos revisado tu solicitud para cancelar la siguiente reserva. Lamentablemente, no podemos cancelarla según nuestra política de cancelación, por lo que tu reserva sigue vigente:",
  cancelDeclinedOutro:
    "Si tienes alguna pregunta, responde a este correo y nuestro equipo estará encantado de ayudarte.",
  adminNoteLabel: "Nota de nuestro equipo",
}

const pt: EmailStrings = {
  brand: "Visit Iceland",
  hi: "Olá {name},",
  tourLabel: "Tour",
  dateLabel: "Data",
  guestsLabel: "Viajantes",
  bookingRefLabel: "Referência da reserva",
  questionsHtml:
    'Dúvidas? Basta responder a este e-mail ou contactar-nos em <a href="mailto:info@visit.is">info@visit.is</a>.',
  footerRights: "Todos os direitos reservados.",
  confirmSubject: "A sua reserva está confirmada – {tour}",
  confirmHeading: "A sua aventura está reservada!",
  confirmIntro:
    "Obrigado por reservar connosco. O seu tour está confirmado e mal podemos esperar para o receber. Aqui estão os detalhes:",
  voucherHeading: "O seu voucher",
  voucherText:
    "Descarregue o seu voucher e tenha-o pronto (no telemóvel ou impresso) no dia do tour.",
  voucherButton: "Descarregar voucher",
  confirmOutro:
    "Chegue alguns minutos mais cedo. Se algo mudar, pode gerir a sua reserva na sua conta.",
  reminderSubjectWeek: "Até daqui a uma semana – {tour}",
  reminderSubjectDay: "O seu tour é amanhã – {tour}",
  reminderHeadingWeek: "O seu tour está a chegar",
  reminderHeadingDay: "O seu tour é amanhã!",
  reminderIntroWeek:
    "Apenas um lembrete de que o seu tour é daqui a uma semana. Aqui estão os detalhes:",
  reminderIntroDay:
    "Estamos ansiosos por vê-lo amanhã! Aqui estão os detalhes:",
  reminderVoucherText:
    "Tenha o seu voucher pronto (no telemóvel ou impresso) quando chegar.",
  reminderChecklist:
    "Vista-se com camadas quentes, leve impermeável e calçado resistente — o tempo na Islândia muda depressa.",
  reminderCancelNote:
    "Não pode comparecer? Pode cancelar na sua conta, sujeito à nossa política de cancelamento.",
  reminderButton: "Descarregar voucher",
  cancelSubject: "A sua reserva foi cancelada – {tour}",
  cancelHeading: "A sua reserva está cancelada",
  cancelIntro: "Conforme solicitado, cancelámos a seguinte reserva:",
  cancelRefund:
    "Como cancelou com mais de 72 horas de antecedência, a sua reserva é totalmente reembolsada de acordo com a nossa política de cancelamento. Os reembolsos são processados para o método de pagamento original.",
  cancelOutro:
    "Lamentamos não o ver desta vez e esperamos recebê-lo em breve noutra aventura.",
  cancelReqSubject: "Recebemos o seu pedido de cancelamento – {tour}",
  cancelReqHeading: "Pedido de cancelamento recebido",
  cancelReqIntro:
    "Recebemos o seu pedido para cancelar a seguinte reserva. Como faltam menos de 72 horas para a partida, a nossa equipa irá analisá-lo de acordo com a nossa política de cancelamento e responder-lhe em breve:",
  cancelReqOutro:
    "Por agora não precisa de fazer mais nada — enviaremos um e-mail assim que o seu pedido for analisado.",
  cancelApprovedSubject: "O seu cancelamento está confirmado – {tour}",
  cancelApprovedHeading: "O seu cancelamento está aprovado",
  cancelApprovedIntro:
    "Analisámos o seu pedido e cancelámos a seguinte reserva:",
  cancelApprovedOutro:
    "Qualquer reembolso devido será processado para o seu método de pagamento original de acordo com a nossa política de cancelamento. Esperamos recebê-lo em breve noutra aventura.",
  cancelDeclinedSubject: "Atualização sobre o seu pedido de cancelamento – {tour}",
  cancelDeclinedHeading: "Sobre o seu pedido de cancelamento",
  cancelDeclinedIntro:
    "Analisámos o seu pedido para cancelar a seguinte reserva. Infelizmente, não podemos cancelá-la ao abrigo da nossa política de cancelamento, pelo que a sua reserva se mantém:",
  cancelDeclinedOutro:
    "Se tiver alguma dúvida, basta responder a este e-mail e a nossa equipa terá todo o gosto em ajudar.",
  adminNoteLabel: "Nota da nossa equipa",
}

const it: EmailStrings = {
  brand: "Visit Iceland",
  hi: "Ciao {name},",
  tourLabel: "Tour",
  dateLabel: "Data",
  guestsLabel: "Viaggiatori",
  bookingRefLabel: "Riferimento prenotazione",
  questionsHtml:
    'Domande? Rispondi a questa email o scrivici a <a href="mailto:info@visit.is">info@visit.is</a>.',
  footerRights: "Tutti i diritti riservati.",
  confirmSubject: "La tua prenotazione è confermata – {tour}",
  confirmHeading: "La tua avventura è prenotata!",
  confirmIntro:
    "Grazie per aver prenotato con noi. Il tuo tour è confermato e non vediamo l'ora di accoglierti. Ecco i dettagli:",
  voucherHeading: "Il tuo voucher",
  voucherText:
    "Scarica il tuo voucher e tienilo pronto (sul telefono o stampato) il giorno del tour.",
  voucherButton: "Scarica il voucher",
  confirmOutro:
    "Arriva qualche minuto prima. Se qualcosa cambia, puoi gestire la prenotazione dal tuo account.",
  reminderSubjectWeek: "Ci vediamo tra una settimana – {tour}",
  reminderSubjectDay: "Il tuo tour è domani – {tour}",
  reminderHeadingWeek: "Il tuo tour si avvicina",
  reminderHeadingDay: "Il tuo tour è domani!",
  reminderIntroWeek:
    "Un promemoria: il tuo tour è tra una settimana. Ecco i dettagli:",
  reminderIntroDay:
    "Non vediamo l'ora di vederti domani! Ecco i dettagli:",
  reminderVoucherText:
    "Tieni pronto il voucher (sul telefono o stampato) al tuo arrivo.",
  reminderChecklist:
    "Vestiti a strati e in modo caldo, porta l'impermeabile e scarpe robuste: il tempo in Islanda cambia in fretta.",
  reminderCancelNote:
    "Non riesci a partecipare? Puoi annullare dal tuo account, secondo la nostra politica di cancellazione.",
  reminderButton: "Scarica il voucher",
  cancelSubject: "La tua prenotazione è stata annullata – {tour}",
  cancelHeading: "La tua prenotazione è annullata",
  cancelIntro: "Come richiesto, abbiamo annullato la seguente prenotazione:",
  cancelRefund:
    "Poiché hai annullato con più di 72 ore di anticipo, la tua prenotazione è completamente rimborsata secondo la nostra politica di cancellazione. I rimborsi vengono elaborati sul metodo di pagamento originale.",
  cancelOutro:
    "Ci dispiace non vederti questa volta e speriamo di accoglierti presto in un'altra avventura.",
  cancelReqSubject: "Abbiamo ricevuto la tua richiesta di annullamento – {tour}",
  cancelReqHeading: "Richiesta di annullamento ricevuta",
  cancelReqIntro:
    "Abbiamo ricevuto la tua richiesta di annullare la seguente prenotazione. Poiché mancano meno di 72 ore alla partenza, il nostro team la valuterà secondo la nostra politica di cancellazione e ti risponderà a breve:",
  cancelReqOutro:
    "Per ora non devi fare altro: ti invieremo un'email non appena la tua richiesta sarà esaminata.",
  cancelApprovedSubject: "Il tuo annullamento è confermato – {tour}",
  cancelApprovedHeading: "Il tuo annullamento è approvato",
  cancelApprovedIntro:
    "Abbiamo esaminato la tua richiesta e annullato la seguente prenotazione:",
  cancelApprovedOutro:
    "Eventuali rimborsi dovuti verranno elaborati sul tuo metodo di pagamento originale secondo la nostra politica di cancellazione. Speriamo di accoglierti presto in un'altra avventura.",
  cancelDeclinedSubject: "Aggiornamento sulla tua richiesta di annullamento – {tour}",
  cancelDeclinedHeading: "Informazioni sulla tua richiesta di annullamento",
  cancelDeclinedIntro:
    "Abbiamo esaminato la tua richiesta di annullare la seguente prenotazione. Purtroppo non possiamo annullarla in base alla nostra politica di cancellazione, quindi la tua prenotazione resta valida:",
  cancelDeclinedOutro:
    "Se hai domande, rispondi a questa email e il nostro team sarà lieto di aiutarti.",
  adminNoteLabel: "Nota del nostro team",
}

const EMAIL_STRINGS: Record<Locale, EmailStrings> = { en, es, pt, it }

export function getEmailStrings(locale: string | null | undefined): EmailStrings {
  return EMAIL_STRINGS[asLocale(locale)] ?? EMAIL_STRINGS[DEFAULT_LOCALE]
}

/** Fill `{token}` placeholders in an email string. */
export function fmtEmail(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}
