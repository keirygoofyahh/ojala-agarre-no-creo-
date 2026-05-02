/**
 * ============================================================================
 * APP.JS - LÓGICA CENTRAL DEL SISTEMA DE AMONESTACIONES
 * ============================================================================
 * 
 * ⚠️ NOTA DE SEGURIDAD PARA PRODUCCIÓN:
 * Este sistema usa localStorage para gestión de sesión y datos.
 * Para entornos de producción se RECOMIENDA ENCARECIDAMENTE:
 * - Backend con sesiones HTTP seguras (cookies HttpOnly + Secure)
 * - Tokens JWT con refresh tokens y rotación
 * - Almacenamiento en base de datos con encriptación
 * - Validación server-side de todas las entradas
 * - HTTPS obligatorio
 * ============================================================================
 */

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const AppConfig = {
    // Claves para almacenamiento local
    STORAGE_KEYS: {
        SESSION: 'amonestaciones_session',
        DATA: 'amonestaciones_data',
        TEACHERS: 'amonestaciones_teachers' // Para demo: usuarios válidos
    },
    
    // Configuración de secciones válidas: Años 1-3, Letras A-L
    SECTIONS: (() => {
        const sections = [];
        for (let year = 1; year <= 3; year++) {
            for (let letterCode = 65; letterCode <= 76; letterCode++) { // A=65, L=76
                sections.push(`${year}${String.fromCharCode(letterCode)}`);
            }
        }
        return sections;
    })(),
    
    // Niveles de gravedad
    SEVERITY_LEVELS: ['Leve', 'Moderada', 'Grave'],
    
    // Usuarios de demostración (EN PRODUCCIÓN: validar contra backend)
    DEMO_TEACHERS: {
        'profesor1': { id: 'T001', name: 'Prof. María González', password: 'demo123' },
        'profesor2': { id: 'T002', name: 'Prof. Carlos Ramírez', password: 'demo456' },
        'admin': { id: 'T999', name: 'Administrador', password: 'admin2024' }
    }
};

// ============================================================================
// MÓDULO: GESTIÓN DE SESIÓN
// ============================================================================
const SessionManager = {
    /**
     * Verifica si hay una sesión activa válida
     * @returns {Object|null} Datos del profesor o null si no hay sesión
     */
    getCurrentSession() {
        try {
            const session = localStorage.getItem(AppConfig.STORAGE_KEYS.SESSION);
            if (!session) return null;
            
            const parsed = JSON.parse(session);
            // Validar que la sesión no haya expirado (opcional: añadir timestamp)
            return parsed;
        } catch (error) {
            console.warn('Error leyendo sesión:', error);
            return null;
        }
    },
    
    /**
     * Inicia una nueva sesión para el profesor
     * @param {Object} teacherData - Datos del profesor autenticado
     */
    login(teacherData) {
        const session = {
            teacherId: teacherData.id,
            teacherName: teacherData.name,
            username: teacherData.username,
            loginTime: new Date().toISOString(),
            // En producción: añadir token JWT y expiration
        };
        
        localStorage.setItem(
            AppConfig.STORAGE_KEYS.SESSION, 
            JSON.stringify(session)
        );
        
        // También guardamos en sessionStorage para mayor seguridad en shared devices
        sessionStorage.setItem(
            AppConfig.STORAGE_KEYS.SESSION + '_temp',
            JSON.stringify({ active: true })
        );
    },
    
    /**
     * Cierra la sesión actual limpiando todo el almacenamiento relacionado
     */
    logout() {
        localStorage.removeItem(AppConfig.STORAGE_KEYS.SESSION);
        sessionStorage.removeItem(AppConfig.STORAGE_KEYS.SESSION + '_temp');
    },
    
    /**
     * Redirige a la página de login si no hay sesión activa
     * @param {string} returnUrl - Página a la que volver tras login (opcional)
     */
    requireAuth(returnUrl = null) {
        if (!this.getCurrentSession()) {
            if (returnUrl) {
                sessionStorage.setItem('return_url', returnUrl);
            }
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },
    
    /**
     * Redirige al dashboard si YA hay sesión activa (para página de login)
     */
    redirectIfAuthenticated() {
        if (this.getCurrentSession()) {
            const returnUrl = sessionStorage.getItem('return_url') || 'amonestacion.html';
            sessionStorage.removeItem('return_url');
            window.location.href = returnUrl;
            return true;
        }
        return false;
    }
};

// ============================================================================
// MÓDULO: GESTIÓN DE DATOS (localStorage)
// ============================================================================
const DataManager = {
    /**
     * Obtiene todas las amonestaciones almacenadas
     * @returns {Array} Lista de registros de amonestaciones
     */
    getAllWarnings() {
        try {
            const data = localStorage.getItem(AppConfig.STORAGE_KEYS.DATA);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error cargando datos:', error);
            return [];
        }
    },
    
    /**
     * Guarda una nueva amonestación con metadatos automáticos
     * @param {Object} warningData - Datos del formulario
     * @returns {Object} Registro completo guardado
     */
    saveWarning(warningData) {
        const session = SessionManager.getCurrentSession();
        if (!session) {
            throw new Error('No hay sesión activa');
        }
        
        const newWarning = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            // Datos del estudiante (del formulario)
            studentName: warningData.studentName?.trim(),
            studentCode: warningData.studentCode?.trim(),
            section: warningData.section,
            severity: warningData.severity,
            reason: warningData.reason?.trim(),
            observations: warningData.observations?.trim(),
            
            // Metadatos automáticos (NO editables por usuario)
            teacherId: session.teacherId,
            teacherName: session.teacherName,
            createdAt: new Date().toISOString(),
            updatedAt: null
        };
        
        // Validación crítica de sección
        if (!AppConfig.SECTIONS.includes(newWarning.section)) {
            throw new Error(`Sección "${newWarning.section}" no válida`);
        }
        
        const allWarnings = this.getAllWarnings();
        allWarnings.unshift(newWarning); // Añadir al inicio (más reciente primero)
        
        localStorage.setItem(
            AppConfig.STORAGE_KEYS.DATA, 
            JSON.stringify(allWarnings)
        );
        
        return newWarning;
    },
    
    /**
     * Elimina una amonestación por ID
     * @param {string} warningId - ID del registro a eliminar
     * @returns {boolean} Éxito de la operación
     */
    deleteWarning(warningId) {
        let allWarnings = this.getAllWarnings();
        const initialLength = allWarnings.length;
        
        allWarnings = allWarnings.filter(w => w.id !== warningId);
        
        if (allWarnings.length < initialLength) {
            localStorage.setItem(
                AppConfig.STORAGE_KEYS.DATA, 
                JSON.stringify(allWarnings)
            );
            return true;
        }
        return false;
    },
    
    /**
     * Filtra amonestaciones según criterios de búsqueda
     * @param {Object} filters - Criterios de filtrado
     * @returns {Array} Resultados filtrados
     */
    filterWarnings(filters = {}) {
        let results = this.getAllWarnings();
        
        // Filtro por búsqueda textual (nombre, código, motivo)
        if (filters.search?.trim()) {
            const term = filters.search.toLowerCase();
            results = results.filter(w => 
                w.studentName?.toLowerCase().includes(term) ||
                w.studentCode?.toLowerCase().includes(term) ||
                w.reason?.toLowerCase().includes(term) ||
                w.section?.toLowerCase().includes(term)
            );
        }
        
        // Filtro por sección
        if (filters.section) {
            results = results.filter(w => w.section === filters.section);
        }
        
        // Filtro por gravedad
        if (filters.severity) {
            results = results.filter(w => w.severity === filters.severity);
        }
        
        // Filtro por profesor emisor
        if (filters.teacherId) {
            results = results.filter(w => w.teacherId === filters.teacherId);
        }
        
        // Filtro por rango de fechas
        if (filters.dateFrom) {
            results = results.filter(w => w.createdAt >= filters.dateFrom);
        }
        if (filters.dateTo) {
            results = results.filter(w => w.createdAt <= filters.dateTo);
        }
        
        // Ordenar por fecha (más reciente primero)
        return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    
    /**
     * Exporta datos a formato CSV para descarga
     * @param {Array} data - Datos a exportar
     * @returns {string} Contenido CSV
     */
    exportToCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = [
            'ID', 'Fecha/Hora', 'Profesor', 'Alumno', 'Código', 
            'Sección', 'Gravedad', 'Motivo', 'Observaciones'
        ];
        
        const rows = data.map(w => [
            w.id,
            new Date(w.createdAt).toLocaleString('es-ES'),
            w.teacherName,
            w.studentName,
            w.studentCode,
            w.section,
            w.severity,
            `"${(w.reason || '').replace(/"/g, '""')}"`,
            `"${(w.observations || '').replace(/"/g, '""')}"`
        ]);
        
        return [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');
    },
    
    /**
     * Limpia TODOS los datos almacenados (función administrativa)
     * ⚠️ IRREVERSIBLE - Usar con precaución
     */
    clearAllData() {
        if (confirm('⚠️ ADVERTENCIA: Esta acción eliminará TODAS las amonestaciones registradas.\n\n¿Estás absolutamente seguro de continuar?')) {
            localStorage.removeItem(AppConfig.STORAGE_KEYS.DATA);
            return true;
        }
        return false;
    }
};

// ============================================================================
// MÓDULO: UTILIDADES DE UI
// ============================================================================
const UIUtils = {
    /**
     * Genera opciones para el selector de secciones (1A-3L)
     * @param {HTMLSelectElement} selectElement - Elemento select a poblar
     */
    populateSectionsSelect(selectElement) {
        if (!selectElement) return;
        
        // Opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleccionar sección...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        selectElement.appendChild(defaultOption);
        
        // Agrupar por año para mejor UX
        let currentYear = null;
        let optgroup = null;
        
        AppConfig.SECTIONS.forEach(section => {
            const year = section[0];
            
            if (year !== currentYear) {
                currentYear = year;
                optgroup = document.createElement('optgroup');
                optgroup.label = `Año ${year}°`;
                selectElement.appendChild(optgroup);
            }
            
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            optgroup.appendChild(option);
        });
    },
    
    /**
     * Formatea fecha ISO a formato legible en español
     * @param {string} isoDate - Fecha en formato ISO
     * @returns {string} Fecha formateada
     */
    formatDate(isoDate) {
        if (!isoDate) return '-';
        return new Date(isoDate).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    /**
     * Muestra notificación toast temporal
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
     */
    showToast(message, type = 'info') {
        // Crear contenedor si no existe
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 9999;
                display: flex; flex-direction: column; gap: 10px;
            `;
            document.body.appendChild(container);
        }
        
        // Crear toast
        const toast = document.createElement('div');
        const colors = {
            success: '#48bb78', error: '#f56565', 
            warning: '#ed8936', info: '#667eea'
        };
        
        toast.style.cssText = `
            padding: 12px 20px; border-radius: 8px; color: white;
            background: ${colors[type] || colors.info};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-weight: 500; animation: slideIn 0.3s ease;
            max-width: 350px;
        `;
        toast.textContent = message;
        
        // Animación de entrada
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        container.appendChild(toast);
        
        // Auto-eliminar después de 4 segundos
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    /**
     * Valida que un campo no esté vacío
     * @param {HTMLInputElement|HTMLTextAreaElement} field - Campo a validar
     * @returns {boolean} Es válido
     */
    validateRequired(field) {
        const value = field.value?.trim();
        if (!value) {
            field.style.borderColor = '#f56565';
            field.focus();
            return false;
        }
        field.style.borderColor = '';
        return true;
    },
    
    /**
     * Escapa contenido HTML para prevenir XSS
     * @param {string} text - Texto a escapar
     * @returns {string} Texto seguro
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================================================
// MÓDULO: AUTENTICACIÓN (Validación de credenciales)
// ============================================================================
const AuthModule = {
    /**
     * Valida credenciales contra usuarios de demostración
     * ⚠️ EN PRODUCCIÓN: Reemplazar con llamada a backend
     * @param {string} username - Nombre de usuario
     * @param {string} password - Contraseña
     * @returns {Object|null} Datos del profesor o null si falla
     */
    validateCredentials(username, password) {
        const teacher = AppConfig.DEMO_TEACHERS[username];
        
        if (teacher && teacher.password === password) {
            return {
                id: teacher.id,
                name: teacher.name,
                username: username
            };
        }
        return null;
    },
    
    /**
     * Procesa el formulario de login
     * @param {Event} event - Evento submit del formulario
     */
    handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value.trim();
        const errorDiv = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit');
        
        // Validaciones básicas
        if (!username || !password) {
            UIUtils.showToast('Por favor, completa usuario y contraseña', 'warning');
            return;
        }
        
        // UI: Estado de carga
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Verificando...';
        }
        if (errorDiv) errorDiv.style.display = 'none';
        
        // Simular delay de red (para UX)
        setTimeout(() => {
            const teacher = this.validateCredentials(username, password);
            
            if (teacher) {
                // Login exitoso
                SessionManager.login(teacher);
                UIUtils.showToast(`¡Bienvenido, ${teacher.name}!`, 'success');
                
                // Redirigir al formulario de amonestaciones
                setTimeout(() => {
                    window.location.href = 'amonestacion.html';
                }, 1000);
            } else {
                // Login fallido
                if (errorDiv) {
                    errorDiv.textContent = 'Usuario o contraseña incorrectos';
                    errorDiv.style.display = 'block';
                }
                UIUtils.showToast('Credenciales inválidas', 'error');
                
                // Resetear botón
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Iniciar Sesión';
                }
                
                // Limpiar contraseña por seguridad
                const passField = document.getElementById('password');
                if (passField) passField.value = '';
            }
        }, 800);
    }
};

// ============================================================================
// MÓDULO: FORMULARIO DE AMONESTACIÓN
// ============================================================================
const WarningFormModule = {
    /**
     * Inicializa el formulario de nueva amonestación
     */
    init() {
        // Verificar autenticación
        if (!SessionManager.requireAuth('amonestacion.html')) {
            return;
        }
        
        // Poblar selector de secciones
        const sectionSelect = document.getElementById('section');
        if (sectionSelect) {
            UIUtils.populateSectionsSelect(sectionSelect);
        }
        
        // Mostrar información del profesor logueado
        const session = SessionManager.getCurrentSession();
        const teacherInfo = document.getElementById('teacher-info');
        if (teacherInfo && session) {
            teacherInfo.textContent = `Profesor: ${session.teacherName}`;
        }
        
        // Configurar evento de submit
        const form = document.getElementById('warning-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        // Botón de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                SessionManager.logout();
                UIUtils.showToast('Sesión cerrada correctamente', 'info');
                setTimeout(() => window.location.href = 'login.html', 500);
            });
        }
    },
    
    /**
     * Maneja el envío del formulario de amonestación
     * @param {Event} event - Evento submit
     */
    handleSubmit(event) {
        event.preventDefault();
        
        // Recopilar datos del formulario
        const formData = {
            studentName: document.getElementById('student-name')?.value,
            studentCode: document.getElementById('student-code')?.value,
            section: document.getElementById('section')?.value,
            severity: document.getElementById('severity')?.value,
            reason: document.getElementById('reason')?.value,
            observations: document.getElementById('observations')?.value
        };
        
        // Validaciones requeridas
        const requiredFields = ['studentName', 'studentCode', 'section', 'severity', 'reason'];
        let isValid = true;
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && !UIUtils.validateRequired(field)) {
                isValid = false;
            }
        });
        
        // Validación específica de sección
        if (formData.section && !AppConfig.SECTIONS.includes(formData.section)) {
            const sectionField = document.getElementById('section');
            if (sectionField) {
                sectionField.style.borderColor = '#f56565';
                UIUtils.showToast('Por favor, selecciona una sección válida del listado', 'error');
            }
            isValid = false;
        }
        
        if (!isValid) {
            UIUtils.showToast('Completa todos los campos obligatorios', 'warning');
            return;
        }
        
        // Intentar guardar
        try {
            const saved = DataManager.saveWarning(formData);
            UIUtils.showToast('✅ Amonestación registrada correctamente', 'success');
            
            // Resetear formulario
            event.target.reset();
            const sectionSelect = document.getElementById('section');
            if (sectionSelect) {
                sectionSelect.selectedIndex = 0;
            }
            
            // Opcional: Redirigir a reporte tras guardar
            // setTimeout(() => window.location.href = 'reporte.html', 1500);
            
        } catch (error) {
            console.error('Error guardando amonestación:', error);
            UIUtils.showToast(`❌ Error: ${error.message}`, 'error');
        }
    }
};

// ============================================================================
// MÓDULO: REPORTE / HISTORIAL
// ============================================================================
const ReportModule = {
    /**
     * Inicializa la página de reporte
     */
    init() {
        // Verificar autenticación
        if (!SessionManager.requireAuth('reporte.html')) {
            return;
        }
        
        // Renderizar tabla inicial
        this.renderTable();
        
        // Configurar filtros
        this.setupFilters();
        
        // Configurar botones de acción
        this.setupActions();
        
        // Mostrar información del profesor
        const session = SessionManager.getCurrentSession();
        const teacherInfo = document.getElementById('teacher-info');
        if (teacherInfo && session) {
            teacherInfo.textContent = `Profesor: ${session.teacherName}`;
        }
        
        // Botón de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                SessionManager.logout();
                UIUtils.showToast('Sesión cerrada correctamente', 'info');
                setTimeout(() => window.location.href = 'login.html', 500);
            });
        }
    },
    
    /**
     * Renderiza la tabla de amonestaciones
     * @param {Array} data - Datos a mostrar (por defecto: todos filtrados)
     */
    renderTable(data = null) {
        const tbody = document.getElementById('warnings-table-body');
        if (!tbody) return;
        
        const warnings = data || DataManager.filterWarnings(this.getCurrentFilters());
        
        if (warnings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #718096;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                        No se encontraron amonestaciones con los filtros actuales
                    </td>
                </tr>
            `;
            this.updateResultsCount(0);
            return;
        }
        
        tbody.innerHTML = warnings.map(w => `
            <tr>
                <td>${UIUtils.escapeHtml(w.studentName)}</td>
                <td>${UIUtils.escapeHtml(w.studentCode)}</td>
                <td><strong>${UIUtils.escapeHtml(w.section)}</strong></td>
                <td>
                    <span class="badge severity-${w.severity.toLowerCase()}">
                        ${UIUtils.escapeHtml(w.severity)}
                    </span>
                </td>
                <td title="${UIUtils.escapeHtml(w.reason)}">
                    ${UIUtils.escapeHtml(w.reason.length > 50 ? w.reason.substring(0, 50) + '...' : w.reason)}
                </td>
                <td>${UIUtils.escapeHtml(w.observations || '-')}</td>
                <td>${UIUtils.formatDate(w.createdAt)}</td>
                <td>${UIUtils.escapeHtml(w.teacherName)}</td>
                <td>
                    <button class="btn-delete btn-sm" data-id="${w.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Configurar eventos de eliminación
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('¿Eliminar esta amonestación? Esta acción no se puede deshacer.')) {
                    if (DataManager.deleteWarning(id)) {
                        UIUtils.showToast('Registro eliminado', 'success');
                        this.renderTable(); // Re-render con datos actualizados
                    } else {
                        UIUtils.showToast('Error al eliminar', 'error');
                    }
                }
            });
        });
        
        this.updateResultsCount(warnings.length);
    },
    
    /**
     * Obtiene filtros actuales desde los inputs del formulario
     * @returns {Object} Objeto con criterios de filtrado
     */
    getCurrentFilters() {
        return {
            search: document.getElementById('filter-search')?.value,
            section: document.getElementById('filter-section')?.value,
            severity: document.getElementById('filter-severity')?.value,
            dateFrom: document.getElementById('filter-date-from')?.value,
            dateTo: document.getElementById('filter-date-to')?.value
        };
    },
    
    /**
     * Configura eventos para los filtros de búsqueda
     */
    setupFilters() {
        const filterInputs = [
            'filter-search', 'filter-section', 'filter-severity',
            'filter-date-from', 'filter-date-to'
        ];
        
        let debounceTimer;
        
        filterInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    // Debounce para no renderizar en cada tecla
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        this.renderTable();
                    }, 300);
                });
            }
        });
        
        // Botón de limpiar filtros
        const clearBtn = document.getElementById('clear-filters-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                filterInputs.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                this.renderTable();
                UIUtils.showToast('Filtros reiniciados', 'info');
            });
        }
    },
    
    /**
     * Configura botones de acción (exportar, limpiar datos)
     */
    setupActions() {
        // Exportar a CSV
        const exportBtn = document.getElementById('export-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = DataManager.filterWarnings(this.getCurrentFilters());
                const csv = DataManager.exportToCSV(data);
                
                if (!csv) {
                    UIUtils.showToast('No hay datos para exportar', 'warning');
                    return;
                }
                
                // Crear descarga
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `amonestaciones_${new Date().toISOString().split('T')[0]}.csv`;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                UIUtils.showToast(`📊 Exportados ${data.length} registros`, 'success');
            });
        }
        
        // Limpiar todos los datos (función administrativa)
        const clearDataBtn = document.getElementById('clear-all-btn');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => {
                if (DataManager.clearAllData()) {
                    UIUtils.showToast('🗑️ Todos los datos han sido eliminados', 'warning');
                    this.renderTable();
                }
            });
        }
    },
    
    /**
     * Actualiza el contador de resultados mostrados
     * @param {number} count - Número de registros
     */
    updateResultsCount(count) {
        const counter = document.getElementById('results-count');
        if (counter) {
            counter.textContent = `${count} resultado${count !== 1 ? 's' : ''}`;
        }
    }
};

// ============================================================================
// INICIALIZACIÓN AUTOMÁTICA POR PÁGINA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Detectar página actual por nombre de archivo
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Redirección automática si ya hay sesión en página de login
    if (currentPage === 'login.html') {
        SessionManager.redirectIfAuthenticated();
        return;
    }
    
    // Inicializar módulo según página
    switch (currentPage) {
        case 'amonestacion.html':
            WarningFormModule.init();
            break;
        case 'reporte.html':
            ReportModule.init();
            break;
        // login.html se maneja con eventos inline en el HTML
    }
});

// ============================================================================
// FUNCIONES GLOBALES PARA EVENTOS HTML (necesarias para onclick inline)
// ============================================================================
window.handleLogin = (event) => AuthModule.handleLogin(event);
window.exportToCSV = () => ReportModule.setupActions(); // Re-trigger export