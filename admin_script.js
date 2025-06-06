// ATENÇÃO: SUBSTITUA ESTE OBJETO COM AS SUAS PRÓPRIAS CONFIGURAÇÕES DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBAbcaz-Dp0FxQbQlqB9uNfTt1OOt97pv0",
    authDomain: "barbearia-86b3b.firebaseapp.com",
    projectId: "barbearia-86b3b",
    storageBucket: "barbearia-86b3b.firebasestorage.app",
    messagingSenderId: "1073400254978",
    appId: "1:1073400254978:web:49271f32d4d84088e88d1b",
  };

// --- Inicialização do Firebase ---
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// --- Referências aos Elementos HTML do Admin ---
const adminMessageDiv = document.getElementById('admin-message');
const adminPanelContentDiv = document.getElementById('admin-panel-content');
const adminUserEmailSpan = document.getElementById('admin-user-email');
const btnAdminLogout = document.getElementById('btn-admin-logout');

const adminBarberSelect = document.getElementById('admin-barber-select');
const adminDatePicker = document.getElementById('admin-date-picker');
const btnLoadAdminSchedules = document.getElementById('btn-load-admin-schedules');
const adminSchedulesListDiv = document.getElementById('admin-schedules-list');

const editBarberSelect = document.getElementById('edit-barber-select');
const editDatePicker = document.getElementById('edit-date-picker');
const btnGenerateDefaultTimes = document.getElementById('btn-generate-default-times');
const generateMessageDiv = document.getElementById('generate-message');
const newBarberNameInput = document.getElementById('new-barber-name');
const btnAddBarber = document.getElementById('btn-add-barber');
const addBarberMessageDiv = document.getElementById('add-barber-message');

const removeBarberSelect = document.getElementById('remove-barber-select');
const btnRemoveBarber = document.getElementById('btn-remove-barber');
const removeBarberMessageDiv = document.getElementById('remove-barber-message');

// --- E-mail do Administrador (MUDE AQUI SE NECESSÁRIO) ---
const ADMIN_EMAIL = 'adm@administrador.com'; // O e-mail do administrador

let currentAdminUser = null;

// --- Funções de Logout do Admin ---
btnAdminLogout.addEventListener('click', async () => {
    try {
        await auth.signOut();
        // O onAuthStateChanged abaixo (deste script) e o de script.js em login.html
        // cuidarão do redirecionamento para login.html após o logout.
    } catch (error) {
        adminMessageDiv.textContent = `Erro ao fazer logout do admin: ${error.message}`;
        adminMessageDiv.style.color = 'red';
        console.error('Erro de logout de admin:', error);
    }
});

// --- Funções do Painel Admin ---

const adminFp = flatpickr(adminDatePicker, {
    dateFormat: "Y-m-d",
    locale: "pt",
});

const editFp = flatpickr(editDatePicker, {
    dateFormat: "Y-m-d",
    locale: "pt",
    minDate: "today",
    disable: [
        function(date) {
            return (date.getDay() === 1);
        }
    ]
});

async function loadAdminBarbers() {
    adminBarberSelect.innerHTML = '<option value="">Todos os Barbeiros</option>';
    editBarberSelect.innerHTML = '<option value="">Selecione um barbeiro</option>';
    try {
        const barbersSnapshot = await db.collection('barbeiros').get();
        barbersSnapshot.forEach(doc => {
            const barber = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = barber.nome;
            adminBarberSelect.appendChild(option.cloneNode(true)); // Adiciona ao filtro
            editBarberSelect.appendChild(option); // Adiciona ao gerenciamento de horários
        });
    } catch (error) {
        console.error("Erro ao carregar barbeiros para admin:", error);
        adminMessageDiv.textContent = "Erro ao carregar barbeiros. Verifique as regras de segurança do Firestore.";
        adminMessageDiv.style.color = "red";
        adminBarberSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        editBarberSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

btnLoadAdminSchedules.addEventListener('click', () => {
    loadAdminSchedules(adminBarberSelect.value, adminDatePicker.value);
});

// Modifique a função loadAdminSchedules
async function loadAdminSchedules(barberId = null, date = null) {
    adminSchedulesListDiv.innerHTML = '<p>Carregando agendamentos...</p>';
    adminMessageDiv.textContent = '';

    let query = db.collection('horariosDisponiveis');

    if (barberId) {
        query = query.where('barbeiroId', '==', barberId);
    }
    if (date) {
        query = query.where('data', '==', date);
    }

    try {
        const querySnapshot = await query.get();
        let totalSchedules = 0;
        adminSchedulesListDiv.innerHTML = '';

        if (querySnapshot.empty) {
            adminSchedulesListDiv.innerHTML = '<p>Nenhum agendamento encontrado para os filtros selecionados.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;
            const barbeiroNome = data.barbeiroId; // Assumindo que barberId é o nome
            const dataAgendamento = data.data;

            data.horarios.forEach(slot => {
                if (!slot.disponivel) { // Apenas horários não disponíveis (agendados)
                    totalSchedules++;
                    const scheduleItem = document.createElement('div');
                    scheduleItem.classList.add('schedule-item', 'booked');

                    // MODIFICAMOS A EXIBIÇÃO AQUI
                    const clientName = slot.clienteNome || 'Nome N/D'; // Pega o nome ou N/D
                    const clientWhatsapp = slot.clienteWhatsapp || 'WhatsApp N/D'; // Pega o WhatsApp ou N/D
                    const clientInfo = `Cliente: ${clientName} (${clientWhatsapp})`;

                    scheduleItem.innerHTML = `
                        <div>
                            <strong>${barbeiroNome}</strong> - ${dataAgendamento} às ${slot.hora}<br>
                            <span>${clientInfo}</span>
                        </div>
                        <button class="btn-unbook" data-doc-id="${docId}" data-time="${slot.hora}">Desmarcar</button>
                    `;
                    adminSchedulesListDiv.appendChild(scheduleItem);
                }
            });
        });

        if (totalSchedules === 0) {
             adminSchedulesListDiv.innerHTML = '<p>Nenhum agendamento encontrado para os filtros selecionados.</p>';
        }

    } catch (error) {
        console.error("Erro ao carregar agendamentos do admin:", error);
        adminSchedulesListDiv.innerHTML = '<p>Erro ao carregar agendamentos. Verifique as regras de segurança.</p>';
        adminMessageDiv.textContent = `Erro: ${error.message}`;
        adminMessageDiv.style.color = 'red';
    }
}


adminSchedulesListDiv.addEventListener('click', async (event) => {
    if (event.target.classList.contains('btn-unbook')) {
        const docId = event.target.dataset.docId;
        const timeToUnbook = event.target.dataset.time;

        if (!confirm(`Tem certeza que deseja desmarcar o horário das ${timeToUnbook} em ${docId}?`)) {
            return;
        }

        try {
            const docRef = db.collection('horariosDisponiveis').doc(docId);
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                if (!doc.exists) {
                    throw "Documento de horários não existe!";
                }

                const data = doc.data();
                const horarios = data.horarios;

                const updatedHorarios = horarios.map(slot => {
                    if (slot.hora === timeToUnbook && !slot.disponivel) {
                        return { ...slot, disponivel: true, clienteId: null }; // Desmarca o horário
                    }
                    return slot;
                });

                transaction.update(docRef, { horarios: updatedHorarios });
            });
            adminMessageDiv.textContent = `Horário das ${timeToUnbook} desmarcado com sucesso!`;
            adminMessageDiv.style.color = 'green';
            loadAdminSchedules(adminBarberSelect.value, adminDatePicker.value); // Recarrega a lista
        } catch (error) {
            adminMessageDiv.textContent = `Erro ao desmarcar horário: ${error}`;
            adminMessageDiv.style.color = 'red';
            console.error("Erro na transação de desmarcar:", error);
        }
    }
});

btnGenerateDefaultTimes.addEventListener('click', async () => {
    const barberId = editBarberSelect.value;
    const date = editDatePicker.value;

    if (!barberId || !date) {
        generateMessageDiv.textContent = 'Selecione um barbeiro e uma data para gerar horários.';
        generateMessageDiv.style.color = 'red';
        return;
    }

    if (!confirm(`Tem certeza que deseja REGENERAR os horários para ${barberId} em ${date}? Isso SOBRESCREVERÁ quaisquer agendamentos existentes neste dia!`)) {
        return;
    }

    generateMessageDiv.textContent = 'Gerando horários...';
    generateMessageDiv.style.color = 'blue';

    try {
        const docId = `${barberId}_${date}`;
        const docRef = db.collection('horariosDisponiveis').doc(docId);
        const defaultHorarios = generateDefaultTimeSlots(); // Reutiliza a função de geração de horários

        await docRef.set({
            barbeiroId: barberId,
            data: date,
            horarios: defaultHorarios
        });

        generateMessageDiv.textContent = `Horários padrão gerados para ${barberId} em ${date} com sucesso!`;
        generateMessageDiv.style.color = 'green';
        console.log(`Horários resetados/gerados para ${barberId} em ${date}.`);

    } catch (error) {
        generateMessageDiv.textContent = `Erro ao gerar horários: ${error.message}`;
        generateMessageDiv.style.color = 'red';
        console.error("Erro ao gerar horários:", error);
    }
});

// A função generateDefaultTimeSlots também será necessária aqui para o admin
function generateDefaultTimeSlots() {
    const slots = [];
    for (let h = 9; h <= 17; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hour = String(h).padStart(2, '0');
            const minute = String(m).padStart(2, '0');
            slots.push({ hora: `${hour}:${minute}`, disponivel: true, clienteId: null });
        }
    }
    return slots;
}


// --- Gerenciamento de Acesso ao Painel Admin (SÓ PARA ADMIN.HTML) ---
auth.onAuthStateChanged((user) => {
    // --- LOGS CRÍTICAS AQUI ---
    console.log('>>> [admin_script.js] onAuthStateChanged acionado <<<');
    console.log('>>> [admin_script.js] user objeto:', user); // Deve mostrar o objeto do usuário logado
    console.log('>>> [admin_script.js] user.email:', user ? user.email : 'NULL'); // Deve mostrar o email do admin
    console.log('>>> [admin_script.js] ADMIN_EMAIL configurado:', ADMIN_EMAIL); // Deve mostrar o email admin da constante
    console.log('>>> [admin_script.js] Comparação (user.email === ADMIN_EMAIL):', user && user.email === ADMIN_EMAIL); // ESSA LINHA PRECISA SER TRUE!

    if (user && user.email === ADMIN_EMAIL) {
        // Se o usuário está logado E é o administrador
        console.log('>>> [admin_script.js] Condição de ADMIN ATENDIDA. Exibindo painel.');
        currentAdminUser = user;
        adminPanelContentDiv.style.display = 'block';
        adminUserEmailSpan.textContent = user.email;
        adminMessageDiv.textContent = ''; // Limpa mensagens

        loadAdminBarbers();
        loadAdminSchedules();
    } else {
        // Se não for admin ou não estiver logado, redireciona para a página de login.
        console.log('>>> [admin_script.js] Condição de ADMIN NÃO ATENDIDA. Redirecionando para login.html.');
        currentAdminUser = null;
        adminPanelContentDiv.style.display = 'none'; // Garante que o painel está escondido
        adminMessageDiv.textContent = 'Acesso restrito. Redirecionando...';
        adminMessageDiv.style.color = 'red';
        setTimeout(() => {
            window.location.href = 'login.html'; // Redireciona para a página de login
        }, 1000); // Reduzi o tempo para 1 segundo para teste rápido
    }
    console.log('>>> [admin_script.js] onAuthStateChanged FINALIZADO <<<');
});
