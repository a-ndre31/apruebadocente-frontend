/* =====================================================================
   TEXTOS LEGALES · ApruebaDocente
   Reemplaza TODO el bloque "const LEGAL = { ... };" de app.js por este archivo
   (desde "const LEGAL_RESP" hasta el "};" final de LEGAL).

   1) Llena los datos de LEGAL_RESP (están entre corchetes).
   2) En app.js, dentro de abrirLegal(), cambia esta línea:
        .map(s => `<h3>${esc(s[0])}</h3><p>${esc(s[1])}</p>`).join('');
      por esta (para que respete los saltos de línea):
        .map(s => `<h3>${esc(s[0])}</h3><p>${fmt(s[1])}</p>`).join('');
   Los textos NO llevan HTML; fmt() ya escapa caracteres y convierte \n en <br>.
   ===================================================================== */

const LEGAL_RESP = {
  nombre:   '[TU NOMBRE Y APELLIDO]',
  id:       '[TU CÉDULA O RUC]',
  correo:   '[TU CORREO DE CONTACTO]',
  whatsapp: '[TU NÚMERO DE WHATSAPP]',
  ciudad:   '[CIUDAD], Ecuador',
  vigencia: '10 de noviembre de 2026',
  conservacionMeses: '12'      // meses que conservas los datos después de vencida la licencia
};

const LEGAL = {

  /* ------------------------------------------------------------------ */
  terminos: {
    titulo: 'Términos y condiciones',
    secciones: [
      ['1. Quién ofrece el servicio y qué ofrece',
        `ApruebaDocente es una plataforma web de práctica para la Evaluación de Desempeño Docente (EVDO), ofrecida por ${LEGAL_RESP.nombre}, con ${LEGAL_RESP.id} (en adelante, “ApruebaDocente”, “nosotros”). La plataforma ofrece evaluaciones diagnósticas y simulacros con preguntas de práctica.\n` +
        `Al comprar, activar o usar una licencia, el docente (en adelante, “el Usuario”) declara que ha leído y acepta estos Términos y la Política de privacidad. Vigentes desde el ${LEGAL_RESP.vigencia}.`],

      ['2. Independencia y alcance',
        'ApruebaDocente es una plataforma privada e independiente. No está afiliada, patrocinada ni avalada por el INEVAL, el Ministerio de Educación ni ninguna entidad pública. Los nombres de esas instituciones se mencionan solo para identificar el tipo de evaluación a la que se prepara el Usuario.\n' +
        'Las preguntas son material de práctica elaborado para este servicio; no son reactivos oficiales ni se garantiza que coincidan con los de la evaluación real. Usar la plataforma no garantiza aprobar ni obtener un puntaje determinado.'],

      ['3. La licencia de uso',
        'La licencia que se vende es un derecho de uso personal, intransferible, no exclusivo y no sublicenciable. Pertenece únicamente al docente a cuyo nombre se emitió y no puede venderse, prestarse, compartirse ni cederse a otra persona.\n' +
        'Cada licencia habilita una sola fase y una sola asignatura, las elegidas al momento de la compra. Para otra fase o asignatura se requiere otra licencia.\n' +
        'La licencia tiene una vigencia de 3 meses contados desde su creación. Vencido ese plazo, el acceso se desactiva.\n' +
        'La compra de una licencia no transfiere al Usuario ninguna propiedad sobre el software ni sobre las preguntas.'],

      ['4. Sesión única y seguridad de la cuenta',
        'Cada licencia permite una sola sesión activa a la vez. Si se inicia sesión en otro dispositivo, la sesión anterior puede cerrarse automáticamente.\n' +
        'El Usuario es responsable de guardar su código de licencia y de no compartirlo. Si detectamos uso simultáneo, uso por varias personas u otras señales de uso indebido, podemos suspender o cancelar la licencia.'],

      ['5. Propiedad del software y de los contenidos',
        `El software de ApruebaDocente (código, diseño, interfaz, funcionalidades y marca) es de propiedad exclusiva de ${LEGAL_RESP.nombre} y está protegido por las normas ecuatorianas de propiedad intelectual (Código Orgánico de la Economía Social de los Conocimientos, Creatividad e Innovación).\n` +
        `El banco de preguntas, sus explicaciones y su organización son obras protegidas por derechos de autor y se explotan comercialmente en ApruebaDocente con la debida autorización de su titular. Todos los derechos están reservados.`],

      ['6. Uso permitido y prohibiciones',
        'El Usuario puede usar la plataforma únicamente para su preparación personal.\n' +
        'Está prohibido: copiar, fotografiar, capturar, grabar, transcribir o difundir las preguntas, opciones o explicaciones; publicarlas en redes, grupos o plataformas; venderlas o regalarlas; usar programas automáticos para extraer contenido; intentar acceder a datos de otros usuarios o al sistema de administración; realizar ingeniería inversa del software; y compartir la licencia.\n' +
        'Durante los exámenes la plataforma puede mostrar una marca de agua con el código de licencia y bloquear acciones como copiar o abrir el menú contextual. Los intentos reiterados de copia pueden anular el examen en curso y llevar a la suspensión de la licencia, sin devolución del precio y sin perjuicio de las acciones legales que correspondan.'],

      ['7. Precio, pago y comprobante',
        'El precio de cada licencia es el informado al momento de la compra. Por cada pago se emitirá el comprobante de venta que corresponda según la normativa tributaria ecuatoriana.'],

      ['8. Desistimiento y devoluciones',
        'Si el Usuario se arrepiente de la compra, puede solicitar la devolución dentro de los 15 días siguientes a la adquisición, escribiendo a los datos de contacto de la sección 13, siempre que la licencia no haya sido utilizada para realizar simulacros completos. Esto se entiende sin perjuicio de los derechos que la Ley Orgánica de Defensa del Consumidor reconoce al Usuario como consumidor y que no pueden renunciarse.\n' +
        'Cuando la licencia se suspenda por incumplir estos Términos, no habrá devolución.'],

      ['9. Disponibilidad y calidad del contenido',
        'Procuramos que la plataforma funcione de forma continua, pero puede haber interrupciones por mantenimiento, fallas de internet o de proveedores tecnológicos. Revisamos las preguntas con cuidado; si el Usuario detecta un error, puede reportarlo a los datos de contacto y lo corregiremos. Las explicaciones tienen fines educativos y de práctica.'],

      ['10. Límite de responsabilidad',
        'ApruebaDocente no se responsabiliza por el resultado que el Usuario obtenga en la evaluación oficial ni por decisiones tomadas con base en los puntajes de práctica. En la medida permitida por la ley, nuestra responsabilidad total frente al Usuario se limita al valor pagado por la licencia, sin perjuicio de los derechos irrenunciables del consumidor.'],

      ['11. Datos personales',
        'El tratamiento de datos personales se rige por la Política de privacidad, que forma parte de estos Términos, y por la Ley Orgánica de Protección de Datos Personales del Ecuador.'],

      ['12. Cambios, ley aplicable y controversias',
        'Podemos actualizar estos Términos; la versión vigente estará siempre publicada en la plataforma con su fecha. Si un cambio afecta sustancialmente al Usuario con licencia vigente, se lo comunicaremos por los canales de contacto disponibles.\n' +
        `Estos Términos se rigen por las leyes de la República del Ecuador. Las partes buscarán primero resolver cualquier controversia de forma amistosa y, de no lograrlo, se someten a los jueces competentes de ${LEGAL_RESP.ciudad}, sin perjuicio de que el Usuario pueda acudir a las autoridades de defensa del consumidor.`],

      ['13. Contacto',
        `Correo: ${LEGAL_RESP.correo}\nWhatsApp: ${LEGAL_RESP.whatsapp}`]
    ]
  },

  /* ------------------------------------------------------------------ */
  privacidad: {
    titulo: 'Política de privacidad',
    secciones: [
      ['1. Responsable del tratamiento',
        `El responsable del tratamiento de tus datos personales es ${LEGAL_RESP.nombre}, con ${LEGAL_RESP.id}, titular de ApruebaDocente.\n` +
        `Contacto para temas de privacidad: ${LEGAL_RESP.correo} · WhatsApp ${LEGAL_RESP.whatsapp}.\n` +
        'No hemos designado un delegado de protección de datos personales; tu contacto directo es el responsable indicado arriba. Esta política se publica en cumplimiento del deber de información de la Ley Orgánica de Protección de Datos Personales (LOPDP).'],

      ['2. Qué datos tratamos',
        'Datos que nos entregas o se registran al crear tu licencia: tu nombre y apellido, y la fase y la asignatura que escogiste.\n' +
        'Datos que genera el uso de la plataforma, necesarios para que funcione: el código de tu licencia, un identificador técnico del dispositivo (guardado en el almacenamiento local de tu navegador) para controlar la sesión única, y tus resultados de práctica (fecha, tipo de examen, puntaje, tiempo usado y respuestas dadas).\n' +
        'No solicitamos ni guardamos cédula, correo electrónico, dirección, datos bancarios ni datos sensibles (salud, origen étnico, religión, orientación sexual, datos biométricos u otros). Si nos escribes por WhatsApp para comprar o pedir soporte, usaremos tu número y tu mensaje solo para atenderte.'],

      ['3. Para qué los usamos',
        'Únicamente para: (a) crear, activar y controlar tu licencia y la sesión única; (b) mostrarte tu historial y resultados de práctica; (c) darte soporte; (d) mejorar la calidad del banco de preguntas con estadísticas generales; y (e) cumplir obligaciones legales, como la emisión de comprobantes de venta.\n' +
        'No usamos tus datos para publicidad de terceros ni para otras finalidades distintas a las anteriores.'],

      ['4. Base legal',
        'Tratamos tus datos porque son necesarios para ejecutar el contrato de licencia que celebras con nosotros, para cumplir obligaciones legales y, cuando corresponde, con tu consentimiento, que nos das de forma libre, informada y específica al aceptar estos textos y usar la plataforma (artículo 7 de la LOPDP).'],

      ['5. Con quién se comparten: no los vendemos ni los cedemos',
        'No vendemos, alquilamos ni compartimos tus datos con terceros para fines propios de ellos.\n' +
        'Para operar el servicio usamos proveedores tecnológicos que actúan solo por nuestra cuenta y bajo nuestras instrucciones (encargados del tratamiento): Supabase (base de datos y autenticación de licencias) y el proveedor que aloja la página web. También se cargan tipografías y bibliotecas desde servidores externos (Google Fonts y jsDelivr), que pueden registrar la dirección IP técnica de tu conexión, como ocurre al visitar cualquier sitio web.\n' +
        'Solo entregaremos datos a una autoridad cuando una ley o una orden legítima nos lo exija.'],

      ['6. Transferencia internacional',
        'Algunos de esos proveedores pueden almacenar o procesar datos en servidores ubicados fuera del Ecuador. Cuando eso ocurre, lo hacemos con proveedores que ofrecen medidas de seguridad adecuadas y para las finalidades indicadas en esta política, conforme a las reglas de transferencia de datos de la LOPDP. Al aceptar esta política, consientes esa transferencia.'],

      ['7. Cuánto tiempo los conservamos',
        `Mientras tu licencia esté vigente (3 meses desde su creación) y hasta ${LEGAL_RESP.conservacionMeses} meses después de su vencimiento, para atender reclamos y soporte. Pasado ese plazo, los eliminamos o anonimizamos. Los datos que consten en comprobantes de venta se conservan durante el tiempo que exija la normativa tributaria.`],

      ['8. Seguridad',
        'Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: conexión cifrada, control de acceso a la base de datos y acceso administrativo restringido. Ningún sistema es 100 % infalible; si ocurriera una vulneración que te afecte, actuaremos y te informaremos conforme a la ley.'],

      ['9. Tus derechos',
        'Tienes derecho a: ser informado sobre el tratamiento de tus datos; acceder a ellos; rectificarlos y actualizarlos; pedir su eliminación; oponerte al tratamiento; solicitar la portabilidad; pedir la suspensión del tratamiento en los casos previstos; y no ser objeto de decisiones basadas únicamente en valoraciones automatizadas con efectos jurídicos sobre ti.\n' +
        `Para ejercerlos, escríbenos a ${LEGAL_RESP.correo} o por WhatsApp al ${LEGAL_RESP.whatsapp}, indicando tu nombre y código de licencia. El ejercicio es gratuito y lo atenderemos en los plazos que establece la ley.`],

      ['10. Decisiones automatizadas',
        'Los puntajes de tus simulacros se calculan automáticamente y sirven solo como práctica. No generan consecuencias jurídicas ni afectan tus derechos, y no elaboramos perfiles sobre ti.'],

      ['11. Si no entregas los datos o son inexactos',
        'El nombre, apellido, fase y asignatura son necesarios para emitir tu licencia; sin ellos no podemos activarla. Si los datos son inexactos o están desactualizados, podríamos no poder identificar tu licencia o darte soporte correctamente; puedes pedirnos corregirlos en cualquier momento.'],

      ['12. Personas menores de edad',
        'El servicio está dirigido a docentes mayores de edad. No tratamos conscientemente datos de menores.'],

      ['13. Reclamos y cambios',
        'Si consideras que se vulneraron tus derechos, puedes presentar un reclamo ante la Superintendencia de Protección de Datos Personales, autoridad de control en el Ecuador, sin perjuicio de escribirnos primero.\n' +
        `Podemos actualizar esta política; la versión vigente estará siempre publicada en la plataforma. Vigente desde el ${LEGAL_RESP.vigencia}.`]
    ]
  }
};