import { TITULO_TARIFA_RECOGIDA } from "@puntos-recogida/contratos";

/** Textos en español de la página de admin (FR-055 a FR-061, §16). */
export const es = {
  pagina: {
    titulo: "Puntos de recogida",
  },
  queHaceLaApp: {
    titulo: "Qué hace esta app",
    vinetas: [
      "El comprador elige su punto de recogida en el carrito.",
      "En el checkout de ese carrito solo aparece la opción de recogida en el punto elegido.",
      "El pedido guarda el punto elegido y el cliente lo ve en su página de estado del pedido.",
    ],
  },
  pasos: {
    titulo: "Configuración",
    puntos: {
      titulo: "1. Puntos de recogida",
      estado: (total: number) => (total === 1 ? "1 punto" : `${total} puntos`),
      accion: "Gestionar puntos",
    },
    tarifa: {
      titulo: `2. Tarifa "${TITULO_TARIFA_RECOGIDA}"`,
      estado: "Verificar manualmente",
      descripcion:
        `Crea (o ya tienes) una tarifa de envío manual llamada exactamente "${TITULO_TARIFA_RECOGIDA}", ` +
        "con el precio que prefieras. Debe existir en todas las zonas de todos los perfiles de envío " +
        "que puedan participar en un carrito resolado; si falta en alguna, esos checkouts no tendrán " +
        "ninguna opción de entrega.",
      accion: "Abrir envíos",
    },
    appEmbed: {
      titulo: 'App embed "Punto de recogida"',
      numero: "3.",
      estado: "Verificar manualmente",
      descripcion:
        "Activa el embed en el editor de temas para que el selector aparezca en el carrito. " +
        "Se abre a falta de pulsar Guardar.",
      accion: "Activar en el editor de temas",
    },
    personalizaciones: {
      titulo: "4. Personalizaciones de entrega",
      estados: {
        activa: "Activas",
        inactiva: "Inactivas",
        inexistente: "Faltan",
      },
      accion: "Activar",
      exito: "Personalizaciones de entrega activadas.",
    },
    bloquePedido: {
      titulo: "5. Bloque en la página de pedido",
      estado: "Verificar manualmente",
      descripcion:
        'Ve a Configuración → Checkout → Personalizar → página de estado del pedido y agrega el ' +
        'bloque "Punto de recogida".',
      accion: "Abrir ajustes de checkout",
    },
  },
  comoFunciona: {
    titulo: "Cómo funciona",
    texto:
      "El comprador elige su punto en el carrito, el checkout de ese pedido solo ofrece la recogida " +
      "en ese punto, el pedido guarda el punto elegido y el cliente lo ve en su página de estado del " +
      "pedido. El checkout sigue pidiendo una dirección porque las tarifas de envío dependen de la " +
      "zona; si falta el punto elegido, el checkout no tiene ninguna opción de entrega.",
  },
  modoDemo: {
    titulo: "Modo demo",
    texto:
      "Activa el ajuste \"Modo demo\" del app embed en el editor de temas para simular un carrito " +
      "resolado sin depender de un sistema externo. Recuerda desactivarlo antes de salir a producción.",
  },
  antesDeDesinstalar: {
    titulo: "Antes de desinstalar",
    texto:
      "Al desinstalar la app, Shopify elimina el app embed, las Functions y las demás extensiones, " +
      `pero la tarifa "${TITULO_TARIFA_RECOGIDA}" queda visible para todos los compradores. ` +
      "Desactívala o bórrala antes de desinstalar.",
  },
  datosDeEjemplo: {
    titulo: "Datos de ejemplo (solo desarrollo)",
    texto: "Crea 600 puntos de recogida de ejemplo para probar el selector del carrito con más de 500 puntos.",
    accion: "Crear puntos de ejemplo",
    exito: (creados: number) => `${creados} puntos de ejemplo creados`,
  },
  errores: {
    cargaFallida: "No se pudo cargar el estado de la configuración.",
    reintentar: "Reintentar",
  },
} as const;
