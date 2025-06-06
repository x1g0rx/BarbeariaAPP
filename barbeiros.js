// Primeiro, certifique-se de que o Firestore está inicializado:
const db = firebase.firestore();

// Exemplo: Adicionar um novo barbeiro (embora para este app, você faria isso manualmente)
async function adicionarNovoBarbeiro(id, nome, especialidade, diasTrabalho) {
    try {
        await db.collection('barbeiros').doc(id).set({
            nome: nome,
            especialidade: especialidade,
            diasTrabalho: diasTrabalho
        });
        console.log(`Barbeiro ${nome} adicionado com sucesso!`);
    } catch (error) {
        console.error("Erro ao adicionar barbeiro:", error);
    }
}

// Exemplo de como chamar (você não faria isso no frontend em um app de usuário):
// adicionarNovoBarbeiro("carlos-souza", "Carlos Souza", "Barba e Cabelo", ["Terca", "Quarta", "Quinta", "Sexta"]);


// Exemplo: Criar ou atualizar um documento de horários
// Este é o código que já está no seu `script.js` para gerar os horários.
async function loadAvailableTimes(barberId, date) {
    const docId = `${barberId}_${date}`;
    const docRef = db.collection('horariosDisponiveis').doc(docId); // A coleção 'horariosDisponiveis' é criada se não existir

    try {
        const doc = await docRef.get();

        if (doc.exists) {
            // Se o documento existe, apenas o lê
            const data = doc.data();
            displayTimes(data.horarios);
        } else {
            // Se o documento não existe, ele é criado com horários padrão
            const defaultHorarios = generateDefaultTimeSlots();
            await docRef.set({ // .set() cria o documento se ele não existe
                barbeiroId: barberId,
                data: date,
                horarios: defaultHorarios
            });
            displayTimes(defaultHorarios);
            console.log(`Horários padrão criados para ${barberId} em ${date}.`);
        }
    } catch (error) {
        console.error("Erro ao carregar ou criar horários:", error);
    }
}

// Exemplo: Atualizar um horário (marcar como agendado)
// Isso também está no seu script.js, dentro da função bookTime
async function bookTime(barberId, date, time, userId) {
    const docId = `${barberId}_${date}`;
    const docRef = db.collection('horariosDisponiveis').doc(docId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) {
                throw "Documento de horários não existe!";
            }

            const data = doc.data();
            const horarios = data.horarios;
            let bookedSuccessfully = false;

            const updatedHorarios = horarios.map(slot => {
                if (slot.hora === time && slot.disponivel) {
                    bookedSuccessfully = true;
                    return { ...slot, disponivel: false, clienteId: userId };
                }
                return slot;
            });

            if (!bookedSuccessfully) {
                throw "Horário não disponível ou já agendado!";
            }

            // transaction.update() atualiza o documento existente
            transaction.update(docRef, { horarios: updatedHorarios });
        });
        console.log(`Horário das ${time} agendado com sucesso!`);
    } catch (error) {
        console.error("Erro na transação de agendamento:", error);
    }
}