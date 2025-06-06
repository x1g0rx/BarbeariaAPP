// script.js

// --- 1. Importações e Configuração do Firebase ---
// Importações modulares do Firebase SDK via CDN (versão 9.23.0 - verifique a mais recente se precisar)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, runTransaction, setDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 'collection' e 'getDocs' são necessários para listar coleções

// Suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBAbcaz-Dp0FxQbQlqB9uNfTt1OOt97pv0",
    authDomain: "barbearia-86b3b.firebaseapp.com",
    projectId: "barbearia-86b3b",
    storageBucket: "barbearia-86b3b.firebasestorage.app",
    messagingSenderId: "1073400254978",
    appId: "1:1073400254978:web:49271f32d4d84088e88d1b",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Referências aos serviços do Firebase (modular)
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. Referências aos Elementos HTML ---
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnSignup = document.getElementById('btn-signup');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

const messageDiv = document.getElementById('message'); // Mensagens de autenticação
const bookingMessageDiv = document.getElementById('booking-message'); // Mensagens de agendamento
const mySchedulesMessageDiv = document.getElementById('my-schedules-message'); // Mensagens de "Meus Agendamentos"

const authFormDiv = document.getElementById('auth-form'); // Formulário de login/cadastro
const appContentDiv = document.getElementById('app-content'); // Conteúdo principal (agendamento)
const userEmailSpan = document.getElementById('user-email'); // Exibe o e-mail do usuário

const barberSelect = document.getElementById('barber-select');
const datePicker = document.getElementById('date-picker');
const availableTimesDiv = document.getElementById('available-times');
const clientNameInput = document.getElementById('client-name');
const clientWhatsappInput = document.getElementById('client-whatsapp');
const mySchedulesListDiv = document.getElementById('my-schedules-list'); // Lista de agendamentos do usuário

// --- 3. Variáveis de Estado ---
let selectedBarberId = null;
let selectedDate = null;
let currentUser = null; // Armazena o objeto do usuário logado

// --- 4. E-mail do Administrador (MUDE AQUI SE NECESSÁRIO) ---
const ADMIN_EMAIL = 'adm@administrador.com'; // O e-mail do administrador para redirecionamento

// --- 5. Funções Auxiliares de UI ---

/**
 * Exibe uma mensagem em um elemento específico com uma cor definida.
 * @param {HTMLElement} element - O elemento HTML onde a mensagem será exibida.
 * @param {string} msg - A mensagem a ser exibida.
 * @param {string} color - A cor do texto (ex: 'red', 'green', 'blue').
 */
function displayMessage(element, msg, color) {
    element.textContent = msg;
    element.style.color = color;
    
}

/**
 * Limpa uma mensagem de um elemento.
 * @param {HTMLElement} element - O elemento HTML a ser limpo.
 */
function clearMessage(element) {
    element.textContent = '';
}

// --- 6. Funções de Autenticação ---

/**
 * Lida com o registro de um novo usuário.
 */
async function handleSignup() {
    const email = emailInput.value;
    const password = passwordInput.value;
    displayMessage(messageDiv, 'Registrando...', 'blue');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password); // Modular Auth
        displayMessage(messageDiv, 'Usuário registrado com sucesso!', 'green');
        console.log('Usuário registrado:', userCredential.user);
        // onAuthStateChanged cuidará da interface e redirecionamento
    } catch (error) {
        displayMessage(messageDiv, `Erro ao registrar: ${error.message}`, 'red');
        console.error('Erro de registro:', error);
    }
}

/**
 * Lida com o login de um usuário existente.
 */
async function handleLogin() {
    const email = emailInput.value;
    const password = passwordInput.value;
    displayMessage(messageDiv, 'Entrando...', 'blue');

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password); // Modular Auth
        displayMessage(messageDiv, 'Login realizado com sucesso!', 'green');
        console.log('Usuário logado:', userCredential.user);
        // onAuthStateChanged cuidará da interface e redirecionamento
    } catch (error) {
        displayMessage(messageDiv, `Erro ao fazer login: ${error.message}`, 'red');
        console.error('Erro de login:', error);
    }
}

/**
 * Lida com o logout do usuário.
 */
async function handleLogout() {
    try {
        await signOut(auth); // Modular Auth
        displayMessage(messageDiv, 'Logout realizado com sucesso!', 'green');
        console.log('Usuário deslogado.');
        // onAuthStateChanged cuidará de resetar a interface
    } catch (error) {
        displayMessage(messageDiv, `Erro ao fazer logout: ${error.message}`, 'red');
        console.error('Erro de logout:', error);
    }
}

// --- 7. Funções de Agendamento (para Usuários Comuns) ---

// Inicialização do Flatpickr (seletor de datas)
// Certifique-se de que Flatpickr esteja incluído no seu HTML ANTES deste script.
const fp = flatpickr(datePicker, {
    dateFormat: "Y-m-d",
    locale: "pt", // Define o idioma para português
    minDate: "today", // Não permite datas passadas
    disable: [
        function(date) {
            // Desabilita segundas-feiras (dia da semana 1)
            return (date.getDay() === 1);
        }
    ],
    onChange: function(selectedDates, dateStr, instance) {
        selectedDate = dateStr;
        if (selectedBarberId && selectedDate) {
            loadAvailableTimes(selectedBarberId, selectedDate);
        } else {
            availableTimesDiv.innerHTML = '<p>Selecione um barbeiro e uma data para ver os horários.</p>';
        }
    }
});

/**
 * Carrega a lista de barbeiros do Firestore e preenche o dropdown.
 */
async function loadBarbers() {
    barberSelect.innerHTML = '<option value="">Carregando barbeiros...</option>';
    try {
        // Correção: Use collection() e getDocs()
        const barbersColRef = collection(db, 'barbeiros'); // Referência à coleção 'barbeiros'
        const barbersSnapshot = await getDocs(barbersColRef); // Obtenha os documentos
        barberSelect.innerHTML = '<option value="">Selecione um barbeiro</option>'; // Opção padrão
        barbersSnapshot.forEach(doc => {
            const barber = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; // O ID do documento é o nome/ID do barbeiro
            option.textContent = barber.nome;
            barberSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar barbeiros:", error);
        displayMessage(messageDiv, "Erro ao carregar barbeiros. Verifique as regras de segurança.", 'red');
        barberSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

/**
 * Gera uma lista de horários padrão para um dia (9h às 17h, a cada 30 min).
 * @returns {Array<Object>} Um array de objetos de slots de tempo.
 */
function generateDefaultTimeSlots() {
    const slots = [];
    for (let h = 9; h <= 17; h++) { // Das 9h às 17h
        for (let m = 0; m < 60; m += 30) { // A cada 30 minutos
            const hour = String(h).padStart(2, '0');
            const minute = String(m).padStart(2, '0');
            slots.push({ hora: `${hour}:${minute}`, disponivel: true, clienteId: null, clienteNome: null, clienteWhatsapp: null });
        }
    }
    return slots;
}

/**
 * Carrega e exibe os horários disponíveis para um barbeiro e data específicos.
 * Se os horários não existirem para o dia, eles são criados no Firestore.
 * @param {string} barberId - O ID do barbeiro.
 * @param {string} date - A data no formato AAAA-MM-DD.
 */
async function loadAvailableTimes(barberId, date) {
    // ... (código de carregamento de mensagem) ...

    try {
        const docId = `${barberId}_${date}`;
        const docRef = doc(db, 'horariosDisponiveis', docId);
        const docSnap = await getDoc(docRef); // <-- OPERAÇÃO DE LEITURA AQUI

        let horarios;
        if (docSnap.exists()) {
            horarios = docSnap.data().horarios;
        } else {
            // Se o documento não existe, cria horários padrão e os salva
            horarios = generateDefaultTimeSlots();
            // Use setDoc para criar o documento
            await setDoc(docRef, { // <-- OPERAÇÃO DE ESCRITA (CRIAÇÃO) AQUI
                barbeiroId: barberId,
                data: date,
                horarios: horarios
            });
            console.log(`Horários padrão criados para ${barberId} em ${date}.`);
        }
        displayTimes(horarios);
    } catch (error) {
        console.error("Erro ao carregar ou criar horários:", error);
        // ... (código de exibição de erro) ...
    }
}

/**
 * Renderiza os slots de horário na interface do usuário.
 * @param {Array<Object>} horarios - Um array de objetos de slots de tempo.
 */
function displayTimes(horarios) {
    availableTimesDiv.innerHTML = '';
    if (horarios.length === 0) {
        availableTimesDiv.innerHTML = '<p>Nenhum horário disponível para esta data.</p>';
        return;
    }

    horarios.forEach(slot => {
        const timeSlotDiv = document.createElement('div');
        timeSlotDiv.textContent = slot.hora;
        timeSlotDiv.classList.add('time-slot');

        if (slot.disponivel) {
            timeSlotDiv.classList.add('available');
            timeSlotDiv.addEventListener('click', () => {
                // Passa o ID do usuário logado para a função de agendamento
                if (currentUser) {
                    bookTime(selectedBarberId, selectedDate, slot.hora, currentUser.uid);
                } else {
                    displayMessage(bookingMessageDiv, 'Você precisa estar logado para agendar.', 'red');
                }
            });
        } else {
            timeSlotDiv.classList.add('booked');
        }
        availableTimesDiv.appendChild(timeSlotDiv);
    });
}

/**
 * Realiza o agendamento de um horário específico.
 * @param {string} barberId - O ID do barbeiro.
 * @param {string} date - A data do agendamento.
 * @param {string} time - A hora do agendamento.
 * @param {string} userId - O UID do usuário agendando.
 */
async function bookTime(barberId, date, time, userId) {
    const clientName = clientNameInput.value.trim();
    const clientWhatsapp = clientWhatsappInput.value.trim();

    if (!clientName || !clientWhatsapp) {
        displayMessage(bookingMessageDiv, 'Por favor, digite seu nome e número de WhatsApp.', 'red');
        return;
    }

    if (!confirm(`Confirmar agendamento com ${barberId} para ${date} às ${time} em nome de ${clientName}?`)) {
        return;
    }

    displayMessage(bookingMessageDiv, 'Agendando...', 'blue');
    const docId = `${barberId}_${date}`;
    const docRef = doc(db, 'horariosDisponiveis', docId); // Modular doc()

    try {
        await runTransaction(db, async (transaction) => { // Modular runTransaction(db, ...)
            const docSnap = await transaction.get(docRef); // Modular transaction.get()

            if (!docSnap.exists()) {
                throw new Error("Documento de horários não existe!"); // Melhor usar Error
            }

            const data = docSnap.data();
            const horarios = data.horarios;
            let bookedSuccessfully = false;

            const updatedHorarios = horarios.map(slot => {
                if (slot.hora === time && slot.disponivel) {
                    bookedSuccessfully = true;
                    return {
                        ...slot,
                        disponivel: false,
                        clienteId: userId,
                        clienteNome: clientName,
                        clienteWhatsapp: clientWhatsapp
                    };
                }
                return slot;
            });

            if (!bookedSuccessfully) {
                throw new Error("Horário não disponível ou já agendado!"); // Melhor usar Error
            }
            transaction.update(docRef, { horarios: updatedHorarios });
        });

        displayMessage(bookingMessageDiv, `Horário das ${time} agendado para ${clientName} com sucesso!`, 'green');
        console.log(`Horário ${time} agendado para ${clientName} (${clientWhatsapp}) com ${barberId} em ${date}.`);

        // Recarrega os horários disponíveis e os agendamentos do usuário
        loadAvailableTimes(barberId, date);
        loadMySchedules(userId);

    } catch (error) {
        displayMessage(bookingMessageDiv, `Erro ao agendar: ${error.message}`, 'red');
        console.error("Erro na transação de agendamento:", error);
    }
}

/**
 * Carrega e exibe os agendamentos do usuário logado na seção "Meus Agendamentos".
 * @param {string} userId - O UID do usuário logado.
 */
async function loadMySchedules(userId) {
    if (!userId) {
        mySchedulesListDiv.innerHTML = '<p>Faça login para ver seus agendamentos.</p>';
        return;
    }

    mySchedulesListDiv.innerHTML = '<p>Buscando seus agendamentos...</p>';
    clearMessage(mySchedulesMessageDiv);

    try {
        // Correção: Use collection() e getDocs() para buscar todos os documentos da coleção
        const horariosColRef = collection(db, 'horariosDisponiveis');
        const querySnapshot = await getDocs(horariosColRef);
        let foundSchedules = 0;
        mySchedulesListDiv.innerHTML = ''; // Limpa antes de adicionar

        querySnapshot.forEach(docSnap => { // Renomeado para docSnap para clareza
            const data = docSnap.data();
            const docId = docSnap.id;
            const barbeiroNome = data.barbeiroId; // Assumindo que barberId é o nome ou um identificador legível
            const dataAgendamento = data.data;

            data.horarios.forEach(slot => {
                // Verifica se o slot está agendado E se o clienteId corresponde ao usuário logado
                if (!slot.disponivel && slot.clienteId === userId) {
                    foundSchedules++;
                    const scheduleItem = document.createElement('div');
                    // Usamos 'schedule-item' e 'booked' para reusar o estilo do admin/horários agendados
                    scheduleItem.classList.add('schedule-item', 'booked');

                    const clientName = slot.clienteNome || 'Seu Nome';
                    const clientWhatsapp = slot.clienteWhatsapp || 'Seu WhatsApp';

                    scheduleItem.innerHTML = `
                        <div>
                            <strong>Com ${barbeiroNome}</strong> em ${dataAgendamento} às ${slot.hora}<br>
                            <span>Seu nome: ${clientName} | WhatsApp: ${clientWhatsapp}</span>
                        </div>
                        <button class="btn-cancel-my-booking" data-doc-id="${docId}" data-time="${slot.hora}">Desmarcar</button>
                    `;
                    mySchedulesListDiv.appendChild(scheduleItem);
                }
            });
        });

        if (foundSchedules === 0) {
            mySchedulesListDiv.innerHTML = '<p>Você não possui agendamentos futuros.</p>';
        }

    } catch (error) {
        console.error("Erro ao carregar meus agendamentos:", error);
        mySchedulesListDiv.innerHTML = '<p>Erro ao carregar seus agendamentos.</p>';
        displayMessage(mySchedulesMessageDiv, `Erro: ${error.message}`, 'red');
    }
}

/**
 * Lida com a desmarcação de um agendamento por um usuário normal.
 * Garante que apenas o agendamento do próprio usuário pode ser desmarcado.
 * @param {string} docId - O ID do documento do horário (e.g., "barbeiro1_2025-06-07").
 * @param {string} timeToUnbook - A hora do slot a ser desmarcado (e.g., "09:30").
 * @param {HTMLElement} buttonElement - O botão que foi clicado, para atualizar seu estado.
 */
async function handleCancelMyBooking(docId, timeToUnbook, buttonElement) {
    if (!confirm(`Tem certeza que deseja desmarcar seu horário das ${timeToUnbook}?`)) {
        return;
    }

    buttonElement.textContent = 'Desmarcando...';
    buttonElement.disabled = true;

    try {
        const docRef = doc(db, 'horariosDisponiveis', docId); // Modular doc()
        const userId = auth.currentUser.uid; // Garante que é o usuário logado

        await runTransaction(db, async (transaction) => { // Modular runTransaction(db, ...)
            const docSnap = await transaction.get(docRef); // Modular transaction.get()

            if (!docSnap.exists()) {
                throw new Error("Documento de horários não existe!");
            }

            const data = docSnap.data();
            const horarios = data.horarios;
            let unbookedSuccessfully = false;

            const updatedHorarios = horarios.map(slot => {
                // VERIFICAÇÃO CRÍTICA: o slot deve estar agendado E pertencer a este usuário
                if (slot.hora === timeToUnbook && !slot.disponivel && slot.clienteId === userId) {
                    unbookedSuccessfully = true;
                    return {
                        ...slot,
                        disponivel: true, // Volta a ser disponível
                        clienteId: null, // Definir como null
                        clienteNome: null, // Definir como null
                        clienteWhatsapp: null // Definir como null
                    };
                }
                return slot;
            });

            if (!unbookedSuccessfully) {
                throw new Error("Não foi possível desmarcar este horário. Ele pode já ter sido desmarcado ou você não é o agendador.");
            }

            transaction.update(docRef, { horarios: updatedHorarios });
        });

        displayMessage(mySchedulesMessageDiv, `Horário das ${timeToUnbook} desmarcado com sucesso!`, 'green');
        console.log(`Horário ${timeToUnbook} desmarcado pelo cliente ${userId}.`);

        // Recarrega a lista de agendamentos do usuário e os horários disponíveis
        loadMySchedules(userId);
        if (selectedBarberId && selectedDate) {
            loadAvailableTimes(selectedBarberId, selectedDate);
        }
    } catch (error) {
        console.error("Erro ao desmarcar horário pelo usuário:", error);
        displayMessage(mySchedulesMessageDiv, `Erro ao desmarcar: ${error.message}`, 'red');
        buttonElement.textContent = 'Desmarcar'; // Restaura texto do botão
        buttonElement.disabled = false; // Habilita botão novamente
    }
}

// --- 8. Gerenciamento do Estado de Autenticação e Redirecionamento ---

// Usa a função onAuthStateChanged modular
onAuthStateChanged(auth, async (user) => {
    currentUser = user; // Atualiza a variável global currentUser
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html');
    const isAdminUser = user && user.email === ADMIN_EMAIL;

    // Log de depuração (manter para facilitar o debug)
    console.log('--- onAuthStateChanged (script.js) iniciado ---');
    console.log('Usuário logado:', user ? user.email : 'Nenhum');
    console.log('Caminho atual:', currentPath);
    console.log('É a página de login?', isLoginPage);
    console.log('É o administrador?', isAdminUser);

    if (user) { // Se há um usuário logado
        clearMessage(messageDiv); // Limpa qualquer mensagem de autenticação anterior
        userEmailSpan.textContent = user.email;

        if (isAdminUser) {
            // Se o usuário é administrador
            if (!currentPath.includes('admin.html')) {
                console.log('Admin logado, redirecionando para admin.html...');
                window.location.href = 'admin.html';
            } else {
                console.log('Admin logado em admin.html. admin_script.js cuidará do painel.');
                // Já está em admin.html, não faz nada aqui, o outro script cuidará.
                authFormDiv.style.display = 'none';
                appContentDiv.style.display = 'none';
            }
        } else {
            // Se o usuário é um cliente comum
            if (!isLoginPage) {
                console.log('Cliente logado, redirecionando para login.html...');
                window.location.href = 'login.html';
            } else {
                console.log('Cliente logado em login.html. Exibindo interface de agendamento.');
                authFormDiv.style.display = 'none';
                appContentDiv.style.display = 'block';
                await loadBarbers(); // Carrega barbeiros
                await loadMySchedules(user.uid); // Carrega agendamentos do próprio cliente
            }
        }
    } else { // Se não há usuário logado
        currentUser = null;
        console.log('Nenhum usuário logado. Resetando interface.');

        if (!isLoginPage) { // Se não está na página de login, redireciona
            console.log('Não logado e não em login.html, redirecionando para login.html...');
            window.location.href = 'login.html';
        } else { // Já está em login.html e não logado, mostra o formulário de login
            console.log('Não logado e em login.html. Exibindo formulário de login.');
            authFormDiv.style.display = 'block';
            appContentDiv.style.display = 'none';
            userEmailSpan.textContent = '';
            clearMessage(messageDiv);
            clearMessage(bookingMessageDiv);
            clearMessage(mySchedulesMessageDiv);

            // Reseta seleções e displays
            barberSelect.innerHTML = '<option value="">Selecione um barbeiro</option>';
            availableTimesDiv.innerHTML = '<p>Selecione um barbeiro e uma data para ver os horários.</p>';
            mySchedulesListDiv.innerHTML = '<p>Faça login para ver seus agendamentos.</p>';
            selectedBarberId = null;
            selectedDate = null;
            fp.clear(); // Limpa o calendário do flatpickr
        }
    }
    console.log('--- onAuthStateChanged (script.js) finalizado ---');
});

// --- 9. Listeners de Eventos ---

// Autenticação
btnSignup.addEventListener('click', handleSignup);
btnLogin.addEventListener('click', handleLogin);
btnLogout.addEventListener('click', handleLogout);

// Agendamento
barberSelect.addEventListener('change', (event) => {
    selectedBarberId = event.target.value;
    if (selectedBarberId && selectedDate) {
        loadAvailableTimes(selectedBarberId, selectedDate);
    } else {
        availableTimesDiv.innerHTML = '<p>Selecione um barbeiro e uma data para ver os horários.</p>';
    }
});

// Desmarcar agendamento do cliente (usando delegação de eventos para botões dinâmicos)
mySchedulesListDiv.addEventListener('click', (event) => {
    if (event.target.classList.contains('btn-cancel-my-booking')) {
        const button = event.target;
        const docId = button.dataset.docId;
        const timeToUnbook = button.dataset.time;
        handleCancelMyBooking(docId, timeToUnbook, button);
    }
});
