import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motivosCita, generarCodigoCita } from '../data/datosSimulados';
import {
  validarPadre,
  listarDocentes,
  obtenerHorarios,
  confirmarCita,
} from '../services/api';
import MisCitas from './MisCitas';
import '../assets/styles/EduBotChat.css';

// ─── Helper: formatters ───────────────────────────────────────────────────────
function formatFecha(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatFechaCort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'long' });
}
function nowTime() {
  return new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

// ─── Calendar Component ───────────────────────────────────────────────────────
function CalendarioSimple({ disponibilidad, onSelect }) {
  const fechas = Object.keys(disponibilidad).sort();
  const [mes, setMes] = useState(() => {
    const first = fechas[0];
    if (first) return first.slice(0, 7);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [año, mesNum] = mes.split('-').map(Number);
  const primerDia = new Date(año, mesNum - 1, 1).getDay();
  const diasEnMes = new Date(año, mesNum, 0).getDate();
  const diasSemana = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const prevMes = () => {
    const d = new Date(año, mesNum - 2, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMes = () => {
    const d = new Date(año, mesNum, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const cells = [];
  for (let i = 0; i < primerDia; i++) cells.push(null);
  for (let d = 1; d <= diasEnMes; d++) cells.push(d);

  return (
    <div className="calendario">
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMes}>‹</button>
        <span className="cal-mes">{meses[mesNum - 1]} {año}</span>
        <button className="cal-nav" onClick={nextMes}>›</button>
      </div>
      <div className="cal-grid-header">
        {diasSemana.map(d => <span key={d} className="cal-dow">{d}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} className="cal-cell empty" />;
          const iso = `${año}-${String(mesNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const tieneSlots = !!disponibilidad[iso];
          return (
            <button
              key={iso}
              className={`cal-cell ${tieneSlots ? 'disponible' : 'no-disponible'}`}
              disabled={!tieneSlots}
              onClick={() => tieneSlots && onSelect(iso)}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Prediction Card ───────────────────────────────────────────────────────
function TarjetaPrediccionIA({ slots, docenteNombre, onSelect, onVerTodos }) {
  return (
    <div className="ia-card">
      <div className="ia-card-header">
        <span className="ia-badge">✨ Sugerencia IA</span>
        <p className="ia-card-subtitle">Mejores horarios para ti con {docenteNombre}</p>
      </div>
      <div className="ia-slots">
        {slots.map((slot, idx) => (
          <button key={slot.disponibilidadId + slot.fecha} className="ia-slot" onClick={() => onSelect(slot)}>
            <div className="ia-slot-left">
              <span className="ia-rank">{idx === 0 ? '⭐' : idx === 1 ? '🥈' : '🥉'}</span>
              <div>
                <div className="ia-slot-hora">{slot.horaInicio} – {slot.horaFin}</div>
                <div className="ia-slot-fecha">{formatFechaCort(slot.fecha)}</div>
              </div>
            </div>
            <div className="ia-slot-right">
              <span className="ia-razon">{slot.razon}</span>
              <span className="ia-select-btn">Elegir →</span>
            </div>
          </button>
        ))}
      </div>
      <button className="ia-ver-todos" onClick={onVerTodos}>
        Ver todos los horarios disponibles
      </button>
    </div>
  );
}

// ─── Manual slot selector ─────────────────────────────────────────────────────
function SelectorHorario({ disponibilidad, fechaSeleccionada, onSelectFecha, onSelectSlot }) {
  const slotsFecha = fechaSeleccionada ? (disponibilidad[fechaSeleccionada] || []) : [];
  return (
    <div className="selector-horario">
      <CalendarioSimple disponibilidad={disponibilidad} onSelect={onSelectFecha} />
      {fechaSeleccionada && (
        <div className="slots-lista">
          <p className="slots-titulo">Disponibilidad · {formatFechaCort(fechaSeleccionada)}</p>
          {slotsFecha.map(slot => (
            <button key={slot.disponibilidadId} className="slot-btn" onClick={() => onSelectSlot(slot, fechaSeleccionada)}>
              <span className="slot-clock">🕐</span>
              <span className="slot-hora">{slot.horaInicio} – {slot.horaFin}</span>
              <span className="slot-tag free">✓ Libre</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Confirmation Card ────────────────────────────────────────────────────────
function TarjetaConfirmacion({ cita }) {
  const codigo = generarCodigoCita(cita.fecha);
  return (
    <div className="confirm-card">
      <div className="confirm-header">
        <span className="confirm-icon">📅</span>
        <div>
          <div className="confirm-title">Cita Confirmada</div>
          <div className="confirm-school">IE San Martín de Porres</div>
        </div>
      </div>
      <div className="confirm-details">
        <div className="confirm-row"><span>Ticket</span><span style={{color:'var(--brand)',fontWeight:700}}>{cita.ticket || codigo}</span></div>
        <div className="confirm-row"><span>Docente</span><span>{cita.docente}</span></div>
        <div className="confirm-row"><span>Curso</span><span>{cita.curso}</span></div>
        <div className="confirm-row"><span>Motivo</span><span>{cita.motivo}</span></div>
        <div className="confirm-row"><span>Fecha</span><span>{formatFecha(cita.fecha)}</span></div>
        <div className="confirm-row"><span>Hora</span><span>{cita.horaInicio} – {cita.horaFin}</span></div>
      </div>
      <div className="confirm-codigo">{cita.ticket || codigo}</div>
      <p className="confirm-code-label">Código de confirmación · Muéstralo en portería</p>
      <div className="confirm-recordatorios">
        <div className="rec-header">🔔 Recordatorios activados:</div>
        <div className="rec-item">• 24 h antes</div>
        <div className="rec-item">• 1 h antes</div>
      </div>
    </div>
  );
}

// ─── Quick Reply Chips ────────────────────────────────────────────────────────
function QuickReplies({ options, onSelect }) {
  return (
    <div className="quick-replies">
      {options.map(opt => (
        <button key={opt.id} className="qr-btn" onClick={() => onSelect(opt)}>
          {opt.icon && <span>{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Burbuja({ msg }) {
  const isOut = msg.from === 'user';
  return (
    <div className={`msg-row ${isOut ? 'out' : 'in'}`}>
      {!isOut && <div className="msg-avatar">E</div>}
      <div className={`msg-bubble ${isOut ? 'bubble-out' : 'bubble-in'}`}>
        {msg.text && <p className="msg-text">{msg.text}</p>}
        {msg.card}
        <span className="msg-time">{msg.time}{isOut && <span className="msg-checks"> ✓✓</span>}</span>
      </div>
    </div>
  );
}

// ─── MAIN CHAT ────────────────────────────────────────────────────────────────
const PASOS = {
  INICIO: 'inicio',
  IDENTIFICAR: 'identificar',
  ELEGIR_DOCENTE: 'elegir_docente',
  ELEGIR_MOTIVO: 'elegir_motivo',
  IA_SUGERENCIA: 'ia_sugerencia',
  SLOT_MANUAL: 'slot_manual',
  CONFIRMADO: 'confirmado',
  MIS_CITAS: 'mis_citas',
};

export default function EduBotChat() {
  const [mensajes, setMensajes] = useState([]);
  const [paso, setPaso] = useState(PASOS.INICIO);
  const [input, setInput] = useState('');
  const [padre, setPadre] = useState(null);
  const [docentes, setDocentes] = useState([]);
  const [docenteElegido, setDocenteElegido] = useState(null);
  const [motivo, setMotivo] = useState(null);
  const [horariosData, setHorariosData] = useState(null); // { sugerenciasIA, todosLosHorarios }
  const [fechaSelCalendario, setFechaSelCalendario] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);
  const initDone = useRef(false);

  const addMsg = useCallback((msg) => {
    setMensajes(prev => [...prev, { id: Date.now() + Math.random(), time: nowTime(), ...msg }]);
  }, []);

  const botMsg = useCallback((text, card, delay = 800) => {
    return new Promise(resolve => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addMsg({ from: 'bot', text, card });
        resolve();
      }, delay);
    });
  }, [addMsg]);

  // Init
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    setTimeout(() => {
      addMsg({
        from: 'bot',
        text: '¡Hola! 👋 Soy EduBot, tu asistente virtual del colegio. Estoy aquí para ayudarte a gestionar citas con docentes.',
        card: (
          <div className="welcome-card">
            <div className="wc-title">📅 Agendar Cita</div>
            <div className="wc-body">¿Necesitas hablar con un docente? Agenda tu cita de forma rápida y sencilla.</div>
            <div className="wc-meta">🕐 Horario Lun–Vie · 8:00 AM–4:00 PM</div>
            <div className="wc-meta">📆 Disponibilidad inmediata</div>
            <button className="wc-btn" onClick={() => handleMenuSelect({ id: 'cita', label: 'Agendar cita' })}>
              Agendar Ahora ›
            </button>
          </div>
        ),
        time: nowTime(),
      });
      setPaso(PASOS.INICIO);
    }, 400);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, isTyping]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleMenuSelect(opt) {
    addMsg({ from: 'user', text: opt.label });
    if (opt.id === 'cita') {
      await botMsg('Perfecto 🔑 Primero necesito identificarte. Por favor ingresa tu número de DNI:');
      setPaso(PASOS.IDENTIFICAR);
    } else if (opt.id === 'miscitas') {
      if (!padre) {
        await botMsg('Para ver tus citas primero necesito identificarte. Ingresa tu DNI:');
        setPaso(PASOS.IDENTIFICAR);
        // Guardamos que tras identificarse iremos a mis citas
        setPaso('identificar_miscitas');
      } else {
        setPaso(PASOS.MIS_CITAS);
      }
    } else {
      await botMsg('Puedo ayudarte a:\n• Agendar citas con docentes\n• Ver y cancelar tus citas\n\nElige una opción de abajo. 😊');
    }
  }

  async function handleSendDNI(dni, destino = PASOS.ELEGIR_DOCENTE) {
    try {
      setIsTyping(true);
      const p = await validarPadre(dni);
      setIsTyping(false);
      setPadre(p);
      await botMsg(
        null,
        <div className="id-card">
          <div className="id-ok">✅ Identificado correctamente</div>
          <div className="id-nombre">Hola <strong>{p.nombre} {p.apellido}</strong>
            {p.nombreEstudiante && `, padre/madre de ${p.nombreEstudiante} (${p.gradoEstudiante})`}.
          </div>
        </div>
      );
      if (destino === PASOS.MIS_CITAS) {
        setPaso(PASOS.MIS_CITAS);
      } else {
        await botMsg('¿Con qué docente deseas la cita?');
        // Cargar docentes del backend
        const lista = await listarDocentes();
        setDocentes(lista);
        setPaso(PASOS.ELEGIR_DOCENTE);
      }
    } catch (e) {
      setIsTyping(false);
      await botMsg('❌ No encontré ese DNI en nuestro sistema. Verifica el número e intenta nuevamente.');
    }
  }

  async function handleDocenteSelect(opt) {
    const d = docentes.find(doc => doc.id === opt.id);
    setDocenteElegido(d);
    addMsg({ from: 'user', text: d.nombre });
    await botMsg('¿Cuál es el motivo de la cita? Esto ayuda al docente a prepararse:');
    setPaso(PASOS.ELEGIR_MOTIVO);
  }

  async function handleMotivoSelect(opt) {
    setMotivo(opt);
    addMsg({ from: 'user', text: opt.label });

    try {
      setIsTyping(true);
      const data = await obtenerHorarios(padre.id, docenteElegido.id, opt.id);
      setIsTyping(false);
      setHorariosData(data);

      if (data.sugerenciasIA.length === 0) {
        await botMsg('No hay horarios disponibles para este docente en este momento. Intenta más tarde o elige otro docente.');
        setPaso(PASOS.INICIO);
        return;
      }

      addMsg({
        from: 'bot',
        card: (
          <TarjetaPrediccionIA
            slots={data.sugerenciasIA}
            docenteNombre={docenteElegido.nombre}
            onSelect={(slot) => handleSlotSelect(slot)}
            onVerTodos={handleVerTodos}
          />
        ),
        time: nowTime(),
      });
      setPaso(PASOS.IA_SUGERENCIA);
    } catch (e) {
      setIsTyping(false);
      await botMsg('⚠️ Hubo un error al obtener los horarios: ' + e.message);
    }
  }

  async function handleVerTodos() {
    await botMsg('Elige tu franja horaria entre todos los horarios disponibles:');
    setPaso(PASOS.SLOT_MANUAL);
  }

  async function handleSlotSelect(slot) {
    addMsg({ from: 'user', text: `${slot.horaInicio} – ${slot.horaFin}` });
    addMsg({ from: 'bot', text: '⏳ Confirmando tu cita...', time: nowTime() });

    try {
      const resultado = await confirmarCita({
        padreId: padre.id,
        docenteId: docenteElegido.id,
        disponibilidadId: slot.disponibilidadId,
        motivo: motivo?.id || motivo?.label,
      });

      addMsg({
        from: 'bot',
        card: <TarjetaConfirmacion cita={{ ...resultado, motivo: motivo?.label }} />,
        time: nowTime(),
      });
      setPaso(PASOS.CONFIRMADO);
    } catch (e) {
      await botMsg('❌ ' + e.message + '\n\nElige otro horario o intenta más tarde.');
      setPaso(PASOS.IA_SUGERENCIA);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMsg({ from: 'user', text });

    if (paso === PASOS.IDENTIFICAR || paso === 'identificar_miscitas') {
      const dni = text.replace(/\D/g, '');
      if (dni.length >= 7) {
        const destino = paso === 'identificar_miscitas' ? PASOS.MIS_CITAS : PASOS.ELEGIR_DOCENTE;
        await handleSendDNI(dni, destino);
      } else {
        await botMsg('Por favor ingresa un DNI válido (mínimo 7 dígitos).');
      }
      return;
    }

    await botMsg('Escribe "Cita" para agendar una reunión, o usa los botones de abajo. 😊');
  }

  // Construir mapa de disponibilidad para el selector manual
  function buildDisponibilidadMap() {
    if (!horariosData?.todosLosHorarios) return {};
    const map = {};
    horariosData.todosLosHorarios.forEach(slot => {
      const fecha = String(slot.fecha);
      if (!map[fecha]) map[fecha] = [];
      map[fecha].push(slot);
    });
    return map;
  }

  function renderControls() {
    if (paso === PASOS.INICIO || paso === PASOS.CONFIRMADO) {
      return (
        <QuickReplies
          options={[
            { id: 'cita',     label: '📅 Agendar cita' },
            { id: 'miscitas', label: '🗂️ Mis citas'   },
            { id: 'ayuda',    label: '❓ Ayuda'        },
          ]}
          onSelect={handleMenuSelect}
        />
      );
    }
    if (paso === PASOS.ELEGIR_DOCENTE) {
      return (
        <QuickReplies
          options={docentes.map(d => ({ id: d.id, label: d.nombre }))}
          onSelect={handleDocenteSelect}
        />
      );
    }
    if (paso === PASOS.ELEGIR_MOTIVO) {
      return (
        <QuickReplies
          options={motivosCita.map(m => ({ id: m.id, label: m.label, icon: m.icon }))}
          onSelect={handleMotivoSelect}
        />
      );
    }
    if (paso === PASOS.SLOT_MANUAL) {
      const disp = buildDisponibilidadMap();
      return (
        <div className="manual-selector-wrap">
          <SelectorHorario
            disponibilidad={disp}
            fechaSeleccionada={fechaSelCalendario}
            onSelectFecha={setFechaSelCalendario}
            onSelectSlot={(slot) => handleSlotSelect(slot)}
          />
        </div>
      );
    }
    return null;
  }

  // Vista "Mis Citas"
  if (paso === PASOS.MIS_CITAS) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-header-avatar">E</div>
          <div className="chat-header-info">
            <div className="chat-header-name">EduBot — IE San Martín</div>
            <div className="chat-header-status">
              <span className="status-dot" /> Asistente Virtual · En línea
            </div>
          </div>
        </div>
        <div className="chat-messages" style={{ padding: 0 }}>
          <MisCitas
            padre={padre}
            onVolver={() => setPaso(PASOS.INICIO)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-avatar">E</div>
        <div className="chat-header-info">
          <div className="chat-header-name">EduBot — IE San Martín</div>
          <div className="chat-header-status">
            <span className="status-dot" /> Asistente Virtual · En línea
          </div>
        </div>
        <div className="chat-header-actions">
          {padre && (
            <button className="hdr-btn" title="Mis citas" onClick={() => setPaso(PASOS.MIS_CITAS)}>
              🗂️
            </button>
          )}
          <button className="hdr-btn">🔍</button>
          <button className="hdr-btn">⋮</button>
        </div>
      </div>

      <div className="chat-messages">
        {mensajes.map(msg => <Burbuja key={msg.id} msg={msg} />)}
        {isTyping && (
          <div className="msg-row in">
            <div className="msg-avatar">E</div>
            <div className="typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-controls">{renderControls()}</div>

      <div className="chat-input-bar">
        <button className="inp-attach">😊</button>
        <input
          className="chat-input"
          placeholder="Escribe un mensaje..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="inp-send" onClick={handleSend}>
          {input.trim() ? '➤' : '🎤'}
        </button>
      </div>
    </div>
  );
}
