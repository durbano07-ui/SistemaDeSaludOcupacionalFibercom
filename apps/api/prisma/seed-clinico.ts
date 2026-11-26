/**
 * Datos clínicos de desarrollo (FICTICIOS): organización, 30 trabajadores, catálogo CIE-10
 * reducido, medicamentos y ~40 atenciones de los últimos 4 meses. Las atenciones se registran
 * con la misma función que usa la API (casos, códigos y reglas coherentes).
 */
import {
  coincidenciasAlergia,
  esCedulaValida,
  fechaLocal,
  type NuevaAtencionEntrada,
  nuevaAtencionSchema,
  sumarDias,
} from '@smo/shared';

import type { PrismaClient } from '../src/generated/prisma/client.js';
import { registrarAtencion } from '../src/modules/atenciones/registro-atencion.js';

// ------------------------------------------------------------- organización

const ORGANIZACION: Record<string, string[]> = {
  'Operaciones técnicas': [
    'Técnico instalador',
    'Técnico de fibra óptica',
    'Técnico de soporte de red',
    'Supervisor técnico',
  ],
  Comercial: ['Asesor comercial', 'Jefe comercial'],
  'Atención al cliente': ['Agente de atención al cliente', 'Agente de cobranzas'],
  'Logística y bodega': ['Bodeguero', 'Chofer'],
  'Administración y finanzas': ['Contador', 'Asistente administrativo'],
  'Seguridad y Salud Ocupacional': [],
};

// ------------------------------------------------------------- trabajadores

const NOMBRES_HOMBRE = [
  'Luis Alberto',
  'Jorge Andrés',
  'Diego Fernando',
  'Marco Vinicio',
  'Pablo Esteban',
  'Byron Patricio',
  'Edison Javier',
  'Wilson Rodrigo',
  'Fabián Alejandro',
  'Henry Mauricio',
  'Cristian Paúl',
  'Ángel Gabriel',
  'Darwin Santiago',
  'Iván Leonardo',
  'Franklin Omar',
];
const NOMBRES_MUJER = [
  'María Belén',
  'Ana Lucía',
  'Gabriela Estefanía',
  'Verónica Alexandra',
  'Diana Carolina',
  'Mónica Patricia',
  'Jessica Fernanda',
  'Lorena Isabel',
  'Paola Andrea',
  'Silvia Margarita',
  'Johanna Elizabeth',
  'Tatiana Belén',
  'Rocío del Carmen',
  'Nathaly Sofía',
  'Érika Daniela',
];
const APELLIDOS = [
  'Chimbo',
  'Verdezoto',
  'Camacho',
  'Guamán',
  'Arellano',
  'Coloma',
  'Barragán',
  'Escobar',
  'Llumiguano',
  'Silva',
  'Tapia',
  'Núñez',
  'Galarza',
  'Pazmiño',
  'Ruilova',
  'Yánez',
  'Montero',
  'Cando',
  'Salazar',
  'Vásconez',
  'Ortiz',
  'Gaibor',
  'Lombeida',
  'Paredes',
];

const ALERGIAS = ['Penicilina', 'AINE', 'Sulfas', 'Penicilina'];

// ---------------------------------------------------------------- CIE-10
// Descripciones según la CIE-10 (OPS); el catálogo completo se importará del archivo del MSP.

const CIE10: [string, string][] = [
  ['M54.2', 'Cervicalgia'],
  ['M54.4', 'Lumbago con ciática'],
  ['M54.5', 'Lumbago no especificado'],
  ['M54.6', 'Dolor en la columna dorsal'],
  ['M54.9', 'Dorsalgia, no especificada'],
  ['M25.5', 'Dolor en articulación'],
  ['M75.1', 'Síndrome del manguito rotatorio'],
  ['M77.1', 'Epicondilitis lateral'],
  ['M65.4', 'Tenosinovitis de estiloides radial [de Quervain]'],
  ['M79.1', 'Mialgia'],
  ['G56.0', 'Síndrome del túnel carpiano'],
  ['J00', 'Rinofaringitis aguda [resfriado común]'],
  ['J01.9', 'Sinusitis aguda, no especificada'],
  ['J02.9', 'Faringitis aguda, no especificada'],
  ['J03.9', 'Amigdalitis aguda, no especificada'],
  ['J06.9', 'Infección aguda de las vías respiratorias superiores, no especificada'],
  ['J11.1', 'Influenza con otras manifestaciones respiratorias, virus no identificado'],
  ['J20.9', 'Bronquitis aguda, no especificada'],
  ['J30.4', 'Rinitis alérgica, no especificada'],
  ['J45.9', 'Asma, no especificada'],
  ['A09', 'Diarrea y gastroenteritis de presunto origen infeccioso'],
  ['K29.7', 'Gastritis, no especificada'],
  ['K30', 'Dispepsia'],
  ['K21.9', 'Enfermedad del reflujo gastroesofágico sin esofagitis'],
  ['K59.0', 'Constipación'],
  ['R10.4', 'Otros dolores abdominales y los no especificados'],
  ['R51', 'Cefalea'],
  ['G43.9', 'Migraña, no especificada'],
  ['G44.2', 'Cefalea debida a tensión'],
  ['H10.3', 'Conjuntivitis aguda, no especificada'],
  ['H10.9', 'Conjuntivitis, no especificada'],
  ['L23.9', 'Dermatitis alérgica de contacto, de causa no especificada'],
  ['L24.9', 'Dermatitis de contacto por irritantes, de causa no especificada'],
  ['L30.9', 'Dermatitis, no especificada'],
  ['L50.9', 'Urticaria, no especificada'],
  ['B35.3', 'Tiña del pie'],
  ['I10', 'Hipertensión esencial (primaria)'],
  ['E11.9', 'Diabetes mellitus no insulinodependiente, sin mención de complicación'],
  ['N39.0', 'Infección de vías urinarias, sitio no especificado'],
  ['R50.9', 'Fiebre, no especificada'],
  ['B34.9', 'Infección viral, no especificada'],
  ['Z00.0', 'Examen médico general'],
  ['Z02.1', 'Examen de preempleo'],
  ['S00.0', 'Traumatismo superficial del cuero cabelludo'],
  ['S01.0', 'Herida del cuero cabelludo'],
  ['S13.4', 'Esguince y torcedura de la columna cervical'],
  ['S20.2', 'Contusión del tórax'],
  ['S33.5', 'Esguince y torcedura de la columna lumbar'],
  ['S60.0', 'Contusión de dedo(s) de la mano, sin daño de la(s) uña(s)'],
  ['S61.0', 'Herida de dedo(s) de la mano, sin daño de la(s) uña(s)'],
  ['S63.5', 'Esguince y torcedura de la muñeca'],
  ['S80.0', 'Contusión de la rodilla'],
  ['S93.4', 'Esguince y torcedura del tobillo'],
  ['T14.0', 'Traumatismo superficial de región no especificada del cuerpo'],
  ['T14.1', 'Herida de región no especificada del cuerpo'],
  ['T15.0', 'Cuerpo extraño en la córnea'],
  ['T15.1', 'Cuerpo extraño en el saco conjuntival'],
  ['T23.0', 'Quemadura de la muñeca y de la mano, grado no especificado'],
  ['T67.0', 'Golpe de calor e insolación'],
  ['T75.4', 'Efectos de la corriente eléctrica'],
];

// ------------------------------------------------------------ medicamentos

const MEDICAMENTOS: [string, string, string, string][] = [
  ['Amoxicilina', 'Cápsula', '500 mg', 'Penicilinas'],
  ['Amoxicilina + ácido clavulánico', 'Tableta', '875 mg/125 mg', 'Penicilinas'],
  ['Dicloxacilina', 'Cápsula', '500 mg', 'Penicilinas'],
  ['Ibuprofeno', 'Tableta', '400 mg', 'AINE'],
  ['Diclofenaco', 'Tableta', '50 mg', 'AINE'],
  ['Diclofenaco', 'Gel', '1 %', 'AINE'],
  ['Naproxeno', 'Tableta', '550 mg', 'AINE'],
  ['Paracetamol', 'Tableta', '500 mg', 'Analgésicos'],
  ['Metamizol', 'Ampolla', '1 g/2 ml', 'Analgésicos'],
  ['Loratadina', 'Tableta', '10 mg', 'Antihistamínicos'],
  ['Cetirizina', 'Tableta', '10 mg', 'Antihistamínicos'],
  ['Clorfenamina', 'Tableta', '4 mg', 'Antihistamínicos'],
  ['Omeprazol', 'Cápsula', '20 mg', 'IBP'],
  ['Hidróxido de aluminio y magnesio', 'Suspensión', '200 mg/200 mg/5 ml', 'Antiácidos'],
  ['Cotrimoxazol', 'Tableta', '800 mg/160 mg', 'Sulfonamidas'],
  ['Azitromicina', 'Tableta', '500 mg', 'Macrólidos'],
  ['Ciprofloxacina', 'Tableta', '500 mg', 'Quinolonas'],
  ['Metronidazol', 'Tableta', '500 mg', 'Nitroimidazoles'],
  ['Loperamida', 'Tableta', '2 mg', 'Antidiarreicos'],
  ['Sales de rehidratación oral', 'Sobre', '27,9 g', 'Electrolitos'],
  ['Butilescopolamina', 'Tableta', '10 mg', 'Antiespasmódicos'],
  ['Salbutamol', 'Inhalador', '100 mcg/dosis', 'Broncodilatadores'],
  ['Enalapril', 'Tableta', '10 mg', 'Antihipertensivos'],
  ['Clotrimazol', 'Crema', '1 %', 'Antifúngicos'],
  ['Tobramicina', 'Gotas', '0,3 %', 'Antibióticos oftálmicos'],
];

// ------------------------------------------------------- escenarios clínicos

interface Escenario {
  cie10: string;
  motivo: string;
  enfermedad: string;
  examen: string;
  tratamiento: string;
  medicamentos: {
    nombre: string;
    presentacion: string;
    cantidad: number;
    dosis: string;
    frecuencia: string;
    duracion: string;
  }[];
  recomendaciones?: string;
  signosAlarma?: string;
  reposo?: number;
  laboral?: boolean;
  /** Diagnósticos CIE-10 adicionales al principal. */
  adicionales?: string[];
}

const ESCENARIOS: Escenario[] = [
  {
    cie10: 'M54.5',
    motivo: 'Dolor lumbar',
    enfermedad: 'Dolor lumbar de 3 días tras levantar rollos de cable, sin irradiación.',
    examen: 'Contractura paravertebral lumbar, Lasègue negativo.',
    tratamiento: 'Analgesia, calor local y pausas activas.',
    medicamentos: [
      {
        nombre: 'Paracetamol',
        presentacion: 'Tableta',
        cantidad: 15,
        dosis: '1 tableta',
        frecuencia: 'cada 8 horas',
        duracion: '5 días',
      },
    ],
    recomendaciones:
      'Evitar levantar más de 10 kg por 5 días. Calor local 20 minutos 3 veces al día.',
    reposo: 2,
  },
  {
    cie10: 'M54.2',
    motivo: 'Dolor de cuello',
    enfermedad: 'Cervicalgia de 1 semana asociada a trabajo en altura con la cabeza en extensión.',
    examen: 'Contractura de trapecios, movilidad conservada.',
    tratamiento: 'Antiinflamatorio tópico y ejercicios de estiramiento.',
    medicamentos: [
      {
        nombre: 'Diclofenaco',
        presentacion: 'Gel',
        cantidad: 1,
        dosis: 'Aplicación local',
        frecuencia: 'cada 12 horas',
        duracion: '7 días',
      },
    ],
    recomendaciones: 'Ejercicios de estiramiento cervical cada 2 horas.',
  },
  {
    cie10: 'J06.9',
    adicionales: ['R51'],
    motivo: 'Dolor de garganta y congestión',
    enfermedad: 'Cuadro de 2 días de rinorrea, odinofagia y malestar general.',
    examen: 'Faringe congestiva, sin exudado. Pulmones limpios.',
    tratamiento: 'Sintomático, hidratación.',
    medicamentos: [
      {
        nombre: 'Paracetamol',
        presentacion: 'Tableta',
        cantidad: 9,
        dosis: '1 tableta',
        frecuencia: 'cada 8 horas',
        duracion: '3 días',
      },
      {
        nombre: 'Loratadina',
        presentacion: 'Tableta',
        cantidad: 5,
        dosis: '1 tableta',
        frecuencia: 'cada 24 horas',
        duracion: '5 días',
      },
    ],
    signosAlarma: 'Fiebre mayor a 39 °C, dificultad para respirar.',
  },
  {
    cie10: 'J02.9',
    motivo: 'Dolor de garganta',
    enfermedad: 'Odinofagia de 3 días con fiebre no cuantificada.',
    examen: 'Amígdalas hipertróficas con exudado. Adenopatías cervicales dolorosas.',
    tratamiento: 'Antibiótico y analgesia.',
    medicamentos: [
      {
        nombre: 'Amoxicilina',
        presentacion: 'Cápsula',
        cantidad: 21,
        dosis: '1 cápsula',
        frecuencia: 'cada 8 horas',
        duracion: '7 días',
      },
    ],
    signosAlarma: 'Dificultad para tragar saliva o para abrir la boca.',
    reposo: 1,
  },
  {
    cie10: 'A09',
    motivo: 'Diarrea',
    enfermedad: 'Deposiciones líquidas 5 veces al día desde ayer, sin sangre.',
    examen: 'Abdomen blando, ruidos hidroaéreos aumentados. Mucosas semihúmedas.',
    tratamiento: 'Hidratación oral y dieta blanda.',
    medicamentos: [
      {
        nombre: 'Sales de rehidratación oral',
        presentacion: 'Sobre',
        cantidad: 6,
        dosis: '1 sobre en 1 litro de agua',
        frecuencia: 'a libre demanda',
        duracion: '3 días',
      },
    ],
    recomendaciones: 'Dieta blanda, abundantes líquidos.',
    signosAlarma: 'Sangre en las heces, vómito persistente.',
    reposo: 1,
  },
  {
    cie10: 'K29.7',
    motivo: 'Dolor de estómago',
    enfermedad: 'Epigastralgia urente de 1 semana, relacionada con horarios irregulares de comida.',
    examen: 'Dolor leve a la palpación en epigastrio.',
    tratamiento: 'Protector gástrico y medidas dietéticas.',
    medicamentos: [
      {
        nombre: 'Omeprazol',
        presentacion: 'Cápsula',
        cantidad: 14,
        dosis: '1 cápsula',
        frecuencia: 'cada 24 horas en ayunas',
        duracion: '14 días',
      },
    ],
    recomendaciones: 'Comer a horas fijas, evitar café e irritantes.',
  },
  {
    cie10: 'R51',
    motivo: 'Dolor de cabeza',
    enfermedad: 'Cefalea frontal opresiva de 1 día, sin náusea ni alteraciones visuales.',
    examen: 'Examen neurológico normal.',
    tratamiento: 'Analgesia e hidratación.',
    medicamentos: [
      {
        nombre: 'Paracetamol',
        presentacion: 'Tableta',
        cantidad: 6,
        dosis: '1 tableta',
        frecuencia: 'cada 8 horas',
        duracion: '2 días',
      },
    ],
  },
  {
    cie10: 'H10.3',
    motivo: 'Ojo rojo',
    enfermedad: 'Enrojecimiento y secreción del ojo derecho desde hace 2 días.',
    examen: 'Inyección conjuntival, secreción mucopurulenta, agudeza visual conservada.',
    tratamiento: 'Antibiótico oftálmico y lavado ocular.',
    medicamentos: [
      {
        nombre: 'Tobramicina',
        presentacion: 'Gotas',
        cantidad: 1,
        dosis: '1 gota en el ojo afectado',
        frecuencia: 'cada 6 horas',
        duracion: '7 días',
      },
    ],
    recomendaciones: 'No compartir toallas. Lavado de manos frecuente.',
  },
  {
    cie10: 'L24.9',
    motivo: 'Irritación en las manos',
    enfermedad:
      'Lesiones pruriginosas en el dorso de las manos tras manipular limpiadores de fibra.',
    examen: 'Eritema y descamación en el dorso de ambas manos.',
    tratamiento: 'Antihistamínico y protección de las manos.',
    medicamentos: [
      {
        nombre: 'Cetirizina',
        presentacion: 'Tableta',
        cantidad: 7,
        dosis: '1 tableta',
        frecuencia: 'cada 24 horas',
        duracion: '7 días',
      },
    ],
    recomendaciones: 'Usar guantes de nitrilo al manipular solventes.',
  },
  {
    cie10: 'I10',
    motivo: 'Control de presión arterial',
    enfermedad: 'Paciente con hipertensión conocida, acude a control. Refiere cefalea ocasional.',
    examen: 'Ruidos cardiacos rítmicos, sin edemas.',
    tratamiento: 'Continuar antihipertensivo, dieta hiposódica.',
    medicamentos: [
      {
        nombre: 'Enalapril',
        presentacion: 'Tableta',
        cantidad: 30,
        dosis: '1 tableta',
        frecuencia: 'cada 24 horas',
        duracion: '30 días',
      },
    ],
    recomendaciones: 'Dieta baja en sal, caminata 30 minutos diarios.',
  },
  {
    cie10: 'S61.0',
    motivo: 'Corte en un dedo',
    enfermedad:
      'Herida en el índice izquierdo con herramienta de corte de fibra durante una instalación.',
    examen: 'Herida lineal de 1,5 cm, bordes regulares, sin compromiso tendinoso.',
    tratamiento: 'Limpieza, afrontamiento con puntos adhesivos y curación.',
    medicamentos: [
      {
        nombre: 'Paracetamol',
        presentacion: 'Tableta',
        cantidad: 6,
        dosis: '1 tableta',
        frecuencia: 'cada 8 horas',
        duracion: '2 días',
      },
    ],
    recomendaciones: 'Mantener la herida limpia y seca. Curación en 48 horas.',
    signosAlarma: 'Enrojecimiento, calor o secreción en la herida.',
    reposo: 1,
    laboral: true,
  },
  {
    cie10: 'S93.4',
    adicionales: ['S80.0'],
    motivo: 'Torcedura de tobillo',
    enfermedad: 'Torcedura del tobillo derecho al bajar de una escalera en un poste.',
    examen: 'Edema y dolor en el ligamento peroneo anterior, marcha claudicante.',
    tratamiento: 'Reposo, hielo, compresión y elevación.',
    medicamentos: [
      {
        nombre: 'Paracetamol',
        presentacion: 'Tableta',
        cantidad: 9,
        dosis: '1 tableta',
        frecuencia: 'cada 8 horas',
        duracion: '3 días',
      },
    ],
    recomendaciones: 'Hielo 15 minutos cada 4 horas. Elevar el pie.',
    reposo: 3,
    laboral: true,
  },
  {
    cie10: 'T15.1',
    motivo: 'Cuerpo extraño en el ojo',
    enfermedad:
      'Sensación de cuerpo extraño en el ojo izquierdo tras perforar una pared sin gafas.',
    examen: 'Partícula en el saco conjuntival inferior, retirada con lavado.',
    tratamiento: 'Lavado ocular y antibiótico tópico.',
    medicamentos: [
      {
        nombre: 'Tobramicina',
        presentacion: 'Gotas',
        cantidad: 1,
        dosis: '1 gota',
        frecuencia: 'cada 6 horas',
        duracion: '5 días',
      },
    ],
    recomendaciones: 'Usar siempre gafas de protección al perforar.',
    laboral: true,
  },
];

// ---------------------------------------------------------------- utilidades

/** Generador pseudoaleatorio con semilla (los datos salen iguales en cada máquina). */
function aleatorio(semilla: number) {
  let estado = semilla;
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    entero: (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1)),
    elegir: <T>(lista: readonly T[]) => lista[Math.floor(siguiente() * lista.length)]!,
    probabilidad: (p: number) => siguiente() < p,
  };
}

/** Cédulas ficticias válidas de la provincia de Bolívar (02), a partir de un número. */
function cedulaFicticia(numero: number): string {
  for (let d = 0; d < 10; d++) {
    const cedula = `025${String(numero).padStart(6, '0')}${d}`;
    if (esCedulaValida(cedula)) return cedula;
  }
  throw new Error('No se pudo generar la cédula');
}

const fechaSql = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);

// ---------------------------------------------------------------------- seed

export async function sembrarDatosClinicos(prisma: PrismaClient, idMedico: number): Promise<void> {
  const azar = aleatorio(2026);

  // Organización
  const cargos: number[] = [];
  for (const [departamento, nombresCargo] of Object.entries(ORGANIZACION)) {
    const { idDepartamento } = await prisma.departamento.upsert({
      where: { nombre: departamento },
      update: {},
      create: { nombre: departamento },
    });
    for (const nombre of nombresCargo) {
      const cargo = await prisma.cargo.upsert({
        where: { nombre },
        update: {},
        create: { nombre, idDepartamento },
      });
      cargos.push(cargo.idCargo);
    }
  }
  const bases = await prisma.base.findMany({
    where: { nombre: { in: ['Guaranda', 'San Miguel'] } },
  });
  if (bases.length === 0) throw new Error('Faltan las bases Guaranda y San Miguel.');

  // CIE-10 y medicamentos
  for (const [idCie10, descripcion] of CIE10) {
    await prisma.cie10.upsert({ where: { idCie10 }, update: {}, create: { idCie10, descripcion } });
  }
  const presentaciones = new Map(
    (await prisma.presentacion.findMany()).map((p) => [p.nombre, p.idPresentacion]),
  );
  for (const [nombre, presentacion, concentracion, grupo] of MEDICAMENTOS) {
    const idPresentacion = presentaciones.get(presentacion);
    if (!idPresentacion) throw new Error(`Falta la presentación ${presentacion}`);
    await prisma.medicamento.upsert({
      where: { nombre_idPresentacion_concentracion: { nombre, idPresentacion, concentracion } },
      update: {},
      create: { nombre, idPresentacion, concentracion, grupoFarmacologico: grupo },
    });
  }
  const medicamentos = await prisma.medicamento.findMany({ include: { presentacion: true } });

  // Trabajadores (pacientes: sin nombre de usuario)
  const pacientes: number[] = [];
  for (let i = 0; i < 30; i++) {
    const cedula = cedulaFicticia(1001 + i);
    const mujer = i % 2 === 1;
    const existente = await prisma.usuario.findUnique({
      where: { cedula },
      select: { idUsuario: true },
    });
    if (existente) {
      pacientes.push(existente.idUsuario);
      continue;
    }
    const anio = azar.entero(1972, 2002);
    const usuario = await prisma.usuario.create({
      data: {
        cedula,
        nombres: (mujer ? NOMBRES_MUJER : NOMBRES_HOMBRE)[Math.floor(i / 2) % 15]!,
        apellidos: `${APELLIDOS[i % APELLIDOS.length]} ${APELLIDOS[(i * 7 + 3) % APELLIDOS.length]}`,
        sexo: mujer ? 'mujer' : 'hombre',
        fechaNacimiento: fechaSql(
          `${anio}-${String(azar.entero(1, 12)).padStart(2, '0')}-${String(azar.entero(1, 28)).padStart(2, '0')}`,
        ),
        idBase: bases[i % bases.length]!.idBase,
        idCargo: cargos[i % cargos.length]!,
        correo: `trabajador${i + 1}@ejemplo.invalid`,
      },
    });
    pacientes.push(usuario.idUsuario);

    if (i < ALERGIAS.length) {
      await prisma.historiaClinica.create({
        data: {
          idUsuario: usuario.idUsuario,
          numeroHistoria: `HC-${String(usuario.idUsuario).padStart(6, '0')}`,
          fechaApertura: fechaSql('2025-01-15'),
          alergias: ALERGIAS[i],
        },
      });
    }
    if (i === 5) {
      const embarazo = await prisma.grupoVulnerable.findUniqueOrThrow({
        where: { nombre: 'Embarazo' },
      });
      await prisma.usuarioGrupoVulnerable.create({
        data: {
          idUsuario: usuario.idUsuario,
          idGrupo: embarazo.idGrupo,
          fechaIngreso: fechaSql('2026-08-01'),
        },
      });
    }
    if (i === 6) {
      const fisica = await prisma.discapacidad.findUniqueOrThrow({ where: { nombre: 'Física' } });
      await prisma.usuarioDiscapacidad.create({
        data: {
          idUsuario: usuario.idUsuario,
          idDiscapacidad: fisica.idDiscapacidad,
          porcentaje: 40,
          numeroCarnet: '0000-FICTICIO',
          fechaIngreso: fechaSql('2024-03-01'),
        },
      });
    }
  }
  console.warn(`✓ ${pacientes.length} trabajadores ficticios.`);

  // Atenciones: solo si todavía no hay ninguna
  if ((await prisma.atencion.count()) > 0) {
    console.warn('· Ya hay atenciones: no se generan las de ejemplo.');
    return;
  }

  const hoy = fechaLocal(new Date());
  interface Plan {
    idPaciente: number;
    dia: string;
    escenario: Escenario;
    tipo: 'primera' | 'subsecuente';
  }
  const planes: Plan[] = [];

  // Un paciente con 12 atenciones (para la paginación): 2 casos a lo largo de 4 meses
  const frecuente = pacientes[7]!;
  for (let k = 0; k < 12; k++) {
    planes.push({
      idPaciente: frecuente,
      dia: sumarDias(hoy, -118 + k * 10),
      escenario: k < 6 ? ESCENARIOS[0]! : ESCENARIOS[9]!,
      tipo: k === 0 || k === 6 ? 'primera' : 'subsecuente',
    });
  }
  // 28 atenciones más entre otros pacientes (primeras con alguna subsecuente)
  const otros = pacientes.filter((id) => id !== frecuente);
  let p = 0;
  while (planes.length < 40) {
    const idPaciente = otros[p++ % otros.length]!;
    const escenario = azar.elegir(ESCENARIOS);
    const dia = sumarDias(hoy, -azar.entero(2, 115));
    planes.push({ idPaciente, dia, escenario, tipo: 'primera' });
    if (planes.length < 40 && azar.probabilidad(0.35)) {
      const despues = sumarDias(dia, azar.entero(3, 10));
      if (despues < hoy) planes.push({ idPaciente, dia: despues, escenario, tipo: 'subsecuente' });
    }
  }
  // Al menos dos en el mes actual, para ver la pestaña "Atenciones" con datos
  planes[planes.length - 1]!.dia = sumarDias(hoy, -1);
  planes.sort((a, b) => a.dia.localeCompare(b.dia));

  const alergiasDe = new Map(
    (await prisma.historiaClinica.findMany({ select: { idUsuario: true, alergias: true } })).map(
      (h) => [h.idUsuario, h.alergias],
    ),
  );
  /** CIE-10 del caso abierto de cada paciente. */
  const abiertos = new Map<number, string>();
  let registradas = 0;

  for (const plan of planes) {
    const e = plan.escenario;
    // Una subsecuente solo se suma a un caso abierto del mismo diagnóstico; si no, es primera
    const tipo =
      plan.tipo === 'subsecuente' && abiertos.get(plan.idPaciente) === e.cie10
        ? 'subsecuente'
        : 'primera';
    const hora = `${String(azar.entero(8, 16)).padStart(2, '0')}:${String(azar.entero(0, 59)).padStart(2, '0')}`;

    const detalles = e.medicamentos
      .map((m) => ({
        ...m,
        med: medicamentos.find(
          (x) => x.nombre === m.nombre && x.presentacion.nombre === m.presentacion,
        )!,
      }))
      // Nunca recetar algo a lo que el paciente es alérgico
      .filter(
        ({ med }) =>
          coincidenciasAlergia(alergiasDe.get(plan.idPaciente) ?? null, [
            {
              idMedicamento: med.idMedicamento,
              nombre: med.nombre,
              grupoFarmacologico: med.grupoFarmacologico,
            },
          ]).length === 0,
      );
    const conReceta = azar.probabilidad(0.7);
    const conCertificado = e.reposo !== undefined && tipo === 'primera' && azar.probabilidad(0.6);

    const entrada: NuevaAtencionEntrada = {
      idPaciente: plan.idPaciente,
      tipoAtencion: tipo,
      fecha: `${plan.dia}T${hora}`,
      motivo: tipo === 'subsecuente' ? `Control: ${e.motivo.toLowerCase()}` : e.motivo,
      enfermedadActual:
        tipo === 'subsecuente' ? `Evolución favorable. ${e.enfermedad}` : e.enfermedad,
      idCie10: e.cie10,
      diagnosticosAdicionales: e.adicionales,
      tipoEvento: e.laboral ? 'accidente_trabajo' : 'enfermedad_comun',
      ocurrioEnTrabajo: e.laboral ? true : undefined,
      signosVitales: {
        presionSistolica: azar.entero(105, 145),
        presionDiastolica: azar.entero(65, 88),
        frecuenciaCardiaca: azar.entero(62, 96),
        frecuenciaRespiratoria: azar.entero(14, 19),
        saturacionO2: azar.entero(93, 99),
        temperatura: azar.entero(362, 381) / 10,
      },
      examenFisico: e.examen,
      tratamiento: e.tratamiento,
      receta:
        conReceta && (detalles.length || e.recomendaciones)
          ? {
              medicamentos: detalles.map(({ med, cantidad, dosis, frecuencia, duracion }) => ({
                idMedicamento: med.idMedicamento,
                cantidad,
                dosis,
                frecuencia,
                duracion,
              })),
              recomendaciones:
                e.recomendaciones ?? (detalles.length ? undefined : 'Control en 1 semana.'),
              signosAlarma: e.signosAlarma,
            }
          : undefined,
      certificado: conCertificado ? { dias: e.reposo!, fechaInicio: plan.dia } : undefined,
      proximaCita:
        tipo === 'primera' && azar.probabilidad(0.3) ? sumarDias(plan.dia, 7) : undefined,
    };

    await registrarAtencion(prisma, nuevaAtencionSchema.parse(entrada), idMedico);
    if (tipo === 'primera') abiertos.set(plan.idPaciente, e.cie10);
    registradas++;
  }
  console.warn(`✓ ${registradas} atenciones de ejemplo (un paciente con 12).`);
}
