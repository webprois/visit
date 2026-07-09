"use client"

import { useState, useTransition } from "react"
import { X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Locale } from "@/lib/i18n"
import { cancelOrRequest } from "@/app/actions/cancellation"

/**
 * Customer-facing "Cancel booking" control shown on upcoming trips. Whether the
 * cancellation is free/instant or needs a staff request is decided server-side
 * by each tour's own free-cancellation window; this component just relays the
 * outcome via a toast and previews the likely path in the confirm dialog. The
 * window (in hours) comes from `freeCancelHours` and is interpolated into the
 * copy via the `{hours}` placeholder.
 */

type Copy = {
  trigger: string
  /** `{hours}` is replaced with the tour's free-cancellation window. */
  bodyFree: string
  /** Shown when the tour is free to cancel anytime up to departure. */
  bodyFreeAnytime: string
  /** Shown when inside the window (request needed). `{hours}` interpolated. */
  bodyRequest: string
  /** Shown when the booking is unpaid (free, instant, no fee). */
  bodyUnpaid: string
  title: string
  keep: string
  confirm: string
  cancelled: string
  requested: string
  error: string
}

const COPY: Record<Locale, Copy> = {
  en: {
    trigger: "Cancel booking",
    title: "Cancel this booking?",
    bodyFree:
      "You're more than {hours} hours before departure, so this cancellation is free and will be processed right away. You'll get a confirmation email.",
    bodyFreeAnytime:
      "This tour can be cancelled free of charge any time before departure, so this cancellation will be processed right away. You'll get a confirmation email.",
    bodyRequest:
      "You're within {hours} hours of departure. Per this tour's cancellation terms a fee may apply, so this will be sent to our team as a cancellation request. We'll email you once it's reviewed.",
    bodyUnpaid:
      "This booking hasn't been paid yet, so you can cancel it right away at no charge.",
    keep: "Keep booking",
    confirm: "Cancel booking",
    cancelled: "Your booking has been cancelled. Check your email for details.",
    requested: "Cancellation request sent. We'll be in touch by email.",
    error: "Something went wrong. Please try again.",
  },
  es: {
    trigger: "Cancelar reserva",
    title: "¿Cancelar esta reserva?",
    bodyFree:
      "Faltan más de {hours} horas para la salida, así que esta cancelación es gratuita y se procesará de inmediato. Recibirás un correo de confirmación.",
    bodyFreeAnytime:
      "Este tour se puede cancelar gratis en cualquier momento antes de la salida, así que esta cancelación se procesará de inmediato. Recibirás un correo de confirmación.",
    bodyRequest:
      "Faltan menos de {hours} horas para la salida. Según los términos de cancelación de este tour puede aplicarse un cargo, por lo que esto se enviará a nuestro equipo como solicitud de cancelación. Te avisaremos por correo cuando se revise.",
    bodyUnpaid:
      "Esta reserva aún no se ha pagado, así que puedes cancelarla de inmediato sin ningún cargo.",
    keep: "Mantener reserva",
    confirm: "Cancelar reserva",
    cancelled:
      "Tu reserva ha sido cancelada. Revisa tu correo para más detalles.",
    requested:
      "Solicitud de cancelación enviada. Nos pondremos en contacto por correo.",
    error: "Algo salió mal. Inténtalo de nuevo.",
  },
  pt: {
    trigger: "Cancelar reserva",
    title: "Cancelar esta reserva?",
    bodyFree:
      "Faltam mais de {hours} horas para a partida, por isso este cancelamento é gratuito e será processado de imediato. Receberás um e-mail de confirmação.",
    bodyFreeAnytime:
      "Este tour pode ser cancelado gratuitamente a qualquer momento antes da partida, por isso este cancelamento será processado de imediato. Receberás um e-mail de confirmação.",
    bodyRequest:
      "Faltam menos de {hours} horas para a partida. De acordo com os termos de cancelamento deste tour, pode aplicar-se uma taxa, por isso isto será enviado à nossa equipa como pedido de cancelamento. Avisamos-te por e-mail assim que for analisado.",
    bodyUnpaid:
      "Esta reserva ainda não foi paga, por isso podes cancelá-la de imediato sem qualquer custo.",
    keep: "Manter reserva",
    confirm: "Cancelar reserva",
    cancelled:
      "A tua reserva foi cancelada. Verifica o teu e-mail para mais detalhes.",
    requested:
      "Pedido de cancelamento enviado. Entraremos em contacto por e-mail.",
    error: "Algo correu mal. Tenta novamente.",
  },
  it: {
    trigger: "Annulla prenotazione",
    title: "Annullare questa prenotazione?",
    bodyFree:
      "Mancano più di {hours} ore alla partenza, quindi questo annullamento è gratuito e verrà elaborato subito. Riceverai un'email di conferma.",
    bodyFreeAnytime:
      "Questo tour può essere annullato gratuitamente in qualsiasi momento prima della partenza, quindi questo annullamento verrà elaborato subito. Riceverai un'email di conferma.",
    bodyRequest:
      "Mancano meno di {hours} ore alla partenza. Secondo i termini di annullamento di questo tour potrebbe essere applicata una penale, quindi questa verrà inviata al nostro team come richiesta di annullamento. Ti avviseremo via email una volta esaminata.",
    bodyUnpaid:
      "Questa prenotazione non è ancora stata pagata, quindi puoi annullarla subito senza alcun costo.",
    keep: "Mantieni prenotazione",
    confirm: "Annulla prenotazione",
    cancelled:
      "La tua prenotazione è stata annullata. Controlla la tua email per i dettagli.",
    requested:
      "Richiesta di annullamento inviata. Ti contatteremo via email.",
    error: "Qualcosa è andato storto. Riprova.",
  },
}

export function CancelTripButton({
  bookingId,
  travelDate,
  unpaid = false,
  freeCancelHours = 72,
  locale,
}: {
  bookingId: string
  /** Departure time in ms since epoch, or null when unknown. */
  travelDate: number | null
  /** True for bookings that haven't been paid yet (free, instant cancel). */
  unpaid?: boolean
  /**
   * This tour's free-cancellation window in hours (0 = free anytime). Drives
   * the confirm-dialog preview; the authoritative decision is server-side.
   */
  freeCancelHours?: number
  locale: Locale
}) {
  const t = COPY[locale] ?? COPY.en
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Best-effort client-side hint for which message to show. The real decision
  // is made server-side. Unpaid bookings are always free/instant since no
  // payment (and therefore no fee) is involved. A 0-hour window means the tour
  // is free to cancel anytime up to departure.
  const withinWindow =
    !unpaid &&
    freeCancelHours > 0 &&
    travelDate !== null &&
    travelDate - Date.now() < freeCancelHours * 3_600_000

  const hoursLabel = String(freeCancelHours)
  const body = unpaid
    ? t.bodyUnpaid
    : withinWindow
      ? t.bodyRequest.replace("{hours}", hoursLabel)
      : freeCancelHours <= 0
        ? t.bodyFreeAnytime
        : t.bodyFree.replace("{hours}", hoursLabel)

  function onConfirm() {
    startTransition(async () => {
      const result = await cancelOrRequest(bookingId)
      if (!result.ok) {
        toast.error(result.error || t.error)
        return
      }
      setOpen(false)
      toast.success(result.outcome === "cancelled" ? t.cancelled : t.requested)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <X className="size-4" aria-hidden="true" />
        {t.trigger}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t.keep}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              // Keep the dialog open while the async action runs.
              e.preventDefault()
              onConfirm()
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
