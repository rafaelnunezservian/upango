export default function Privacidad() {
  return (
    <main
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <h1>Política de privacidad de Puntos de Recogida</h1>

      <h2>Qué datos trata la app</h2>
      <p>
        Puntos de Recogida no guarda datos personales de compradores ni de
        pedidos. La única información propia que la app almacena es la
        sesión de instalación de cada tienda (un token de acceso sin
        vencimiento y los permisos concedidos), necesaria para hablar con la
        API de administración de Shopify.
      </p>
      <p>
        Los puntos de recogida que carga el comerciante viven en un
        metaobjeto de la propia tienda (Contenido → Metaobjetos), no en un
        servidor de la app. La selección de un punto de recogida se guarda
        como atributos del carrito y, al pagar, como atributos del pedido:
        ambos son datos de Shopify, no de la app.
      </p>

      <h2>Retención</h2>
      <p>
        La sesión de una tienda se conserva mientras la app esté instalada.
        Se borra automáticamente al recibir el webhook{" "}
        <code>app/uninstalled</code> o una solicitud de borrado de la tienda
        (<code>shop/redact</code>).
      </p>

      <h2>Webhooks de privacidad obligatorios</h2>
      <ul>
        <li>
          <code>customers/data_request</code> y <code>customers/redact</code>
          : la app responde 200 y no realiza ninguna acción, porque no
          guarda datos de compradores.
        </li>
        <li>
          <code>shop/redact</code>: la app borra cualquier dato que quede de
          la tienda (sus sesiones).
        </li>
      </ul>

      <h2>Contacto</h2>
      <p>
        Para preguntas sobre esta política, escribe a{" "}
        <a href="mailto:soporte@example.com">soporte@example.com</a>.
      </p>
    </main>
  );
}
