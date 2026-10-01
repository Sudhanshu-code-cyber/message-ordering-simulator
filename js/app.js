const PROCESS_IDS = ["P1", "P2", "P3"];

let lamportClock = {
  P1: 0,

  P2: 0,

  P3: 0,
};

// ======================================================
// VECTOR CLOCKS
// ======================================================

let vectorClock = {
  P1: {
    P1: 0,
    P2: 0,
    P3: 0,
  },

  P2: {
    P1: 0,
    P2: 0,
    P3: 0,
  },

  P3: {
    P1: 0,
    P2: 0,
    P3: 0,
  },
};


let messages = [];

// ======================================================
// MESSAGE ID
// ======================================================

let messageCounter = 1;

// ======================================================
// FIFO SEQUENCE NUMBERS
// ======================================================
//
// Each sender has its own sequence.
//
// P1: M1, M2, M3
//
// P2: M4, M5
//
// etc.
// ======================================================

let senderSequence = {
  P1: 0,

  P2: 0,

  P3: 0,
};
function createEmptyVector() {
  return {
    P1: 0,
    P2: 0,
    P3: 0,
  };
}

// ======================================================
// COPY VECTOR
// ======================================================

function copyVector(vector) {
  return {
    P1: vector.P1,

    P2: vector.P2,

    P3: vector.P3,
  };
}

// ======================================================
// SEND MESSAGE
// ======================================================

function sendMessage() {
  const sender = document.getElementById("sender").value;

  const receiverSelect = document.getElementById("receivers");

  const receivers = Array.from(receiverSelect.selectedOptions).map(
    (option) => option.value,
  );

  const text = document.getElementById("messageText").value.trim();

  // ==================================================
  // VALIDATION
  // ==================================================

  if (receivers.length === 0) {
    alert("Please select at least one receiver.");

    return;
  }

  if (receivers.includes(sender)) {
    alert("Sender cannot be a receiver.");

    return;
  }

  if (text === "") {
    alert("Please enter a message.");

    return;
  }

  // ==================================================
  // LAMPORT SEND EVENT
  // ==================================================

  /*
   * Sender performs a local event.
   */

  lamportClock[sender]++;

  const sendLamport = lamportClock[sender];

  // ==================================================
  // FIFO SEQUENCE
  // ==================================================

  /*
   * One sequence number for one send event.
   *
   * If P1 sends:
   *
   * M1 -> P2,P3
   *
   * sequence = 1
   */

  senderSequence[sender]++;

  const sequenceNumber = senderSequence[sender];

  // ==================================================
  // VECTOR CLOCK SEND EVENT
  // ==================================================

  /*
   * Increment sender's own component.
   */

  vectorClock[sender][sender]++;

  /*
   * Store the vector at send time.
   */

  const messageVector = copyVector(vectorClock[sender]);

  // ==================================================
  // CREATE MESSAGE
  // ==================================================

  const message = {
    id: "M" + messageCounter,

    sender: sender,

    receivers: receivers,

    text: text,

    lamport: sendLamport,

    sequence: sequenceNumber,

    vector: messageVector,

    createdAt: messageCounter,
  };

  // ==================================================
  // STORE MESSAGE
  // ==================================================

  messages.push(message);

  messageCounter++;

  // ==================================================
  // DELIVER MESSAGE TO ALL RECEIVERS
  // ==================================================

  receivers.forEach(function (receiver) {
    receiveMessage(message, receiver);
  });

  // ==================================================
  // UPDATE UI
  // ==================================================

  updateAll();

  // Clear input

  document.getElementById("messageText").value = "";
}

// ======================================================
// RECEIVE MESSAGE
// ======================================================

function receiveMessage(message, receiver) {
  // ==================================================
  // LAMPORT RECEIVE RULE
  // ==================================================
  //
  // Cj = max(Cj, timestamp) + 1
  //
  // ==================================================

  lamportClock[receiver] =
    Math.max(lamportClock[receiver], message.lamport) + 1;

  // ==================================================
  // VECTOR CLOCK RECEIVE RULE
  // ==================================================
  //
  // Vj[k] =
  // max(Vj[k], Vm[k])
  //
  // ==================================================

  for (const process of PROCESS_IDS) {
    vectorClock[receiver][process] = Math.max(
      vectorClock[receiver][process],
      message.vector[process],
    );
  }

  // ==================================================
  // RECEIVER LOCAL EVENT
  // ==================================================

  vectorClock[receiver][receiver]++;
}

// ======================================================
// FIFO ORDERING
// ======================================================
//
// FIFO guarantees:
//
// If P1 sends M1 before M2,
// then every receiver must deliver:
//
// M1 before M2.
//
// Messages from different senders do not have
// a FIFO relationship.
//
// We create a valid linear order by using:
//
// 1. Sender
// 2. Sender sequence number
// 3. Creation order for concurrent messages
//
// ======================================================

function getFIFOOrder() {
  const result = [...messages];

  result.sort(function (a, b) {
    /*
     * Same sender:
     *
     * sequence determines FIFO order.
     */

    if (a.sender === b.sender) {
      if (a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
    }

    /*
     * Different senders:
     *
     * FIFO places no constraint.
     *
     * Use deterministic tie-break.
     */

    if (a.lamport !== b.lamport) {
      return a.lamport - b.lamport;
    }

    if (a.sender !== b.sender) {
      return a.sender.localeCompare(b.sender);
    }

    return a.sequence - b.sequence;
  });

  return result;
}

// ======================================================
// VECTOR CLOCK COMPARISON
// ======================================================
//
// Returns true when:
//
// A < B
//
// Meaning A happened-before B.
//
// Conditions:
//
// 1. Every component A <= B
// 2. At least one component A < B
//
// ======================================================

function vectorLessThan(a, b) {
  let allLessOrEqual = true;

  let atLeastOneLess = false;

  for (const process of PROCESS_IDS) {
    if (a[process] > b[process]) {
      allLessOrEqual = false;

      break;
    }

    if (a[process] < b[process]) {
      atLeastOneLess = true;
    }
  }

  return allLessOrEqual && atLeastOneLess;
}

// ======================================================
// HAPPENED-BEFORE
// ======================================================

function happenedBefore(messageA, messageB) {
  return vectorLessThan(messageA.vector, messageB.vector);
}

// ======================================================
// CHECK CONCURRENT
// ======================================================
//
// Two messages are concurrent when:
//
// A does not happen-before B
//
// AND
//
// B does not happen-before A
//
// ======================================================

function areConcurrent(messageA, messageB) {
  return (
    !happenedBefore(messageA, messageB) && !happenedBefore(messageB, messageA)
  );
}

// ======================================================
// CAUSAL ORDERING
// ======================================================
//
// Causal ordering is a PARTIAL ORDER.
//
// Example:
//
// M1 -> M2
//
// M1 MUST come before M2.
//
// But:
//
// M3 || M4
//
// means they are concurrent.
//
//
// To produce a valid display order, we perform
// a TOPOLOGICAL SORT.
//
// At every step:
//
// 1. Find messages whose causal predecessors
//    have already been delivered.
//
// 2. Select one using a deterministic
//    tie-break rule.
//
// ======================================================

function getCausalOrder() {
  const remaining = [...messages];

  const result = [];

  /*
   * Messages already delivered.
   */

  const delivered = new Set();

  while (remaining.length > 0) {
    /*
     * Find all messages whose causal
     * predecessors have already been
     * delivered.
     */

    const available = remaining.filter(function (candidate) {
      return remaining.every(function (other) {
        /*
         * If "other" happened
         * before candidate,
         * "other" must already
         * be delivered.
         */

        if (other.id === candidate.id) {
          return true;
        }

        if (happenedBefore(other, candidate)) {
          return delivered.has(other.id);
        }

        return true;
      });
    });

    /*
     * Safety check.
     */

    if (available.length === 0) {
      console.error("Causal ordering error.");

      break;
    }

    /*
     * Multiple messages may be concurrent.
     *
     * There is no causal requirement
     * between them.
     *
     * Use deterministic ordering:
     *
     * 1. Lamport
     * 2. Sender
     * 3. Sequence
     */

    available.sort(compareTotalOrder);

    const selected = available[0];

    result.push(selected);

    delivered.add(selected.id);

    /*
     * Remove selected message.
     */

    const index = remaining.findIndex((message) => message.id === selected.id);

    remaining.splice(index, 1);
  }

  return result;
}

// ======================================================
// TOTAL ORDER COMPARATOR
// ======================================================
//
// Every process can calculate the same order:
//
// (Lamport timestamp,
//  Sender ID,
//  Sequence number)
//
// ======================================================

function compareTotalOrder(a, b) {
  // 1. Lamport timestamp

  if (a.lamport !== b.lamport) {
    return a.lamport - b.lamport;
  }

  // 2. Sender ID

  if (a.sender !== b.sender) {
    return a.sender.localeCompare(b.sender);
  }

  // 3. FIFO sequence

  if (a.sequence !== b.sequence) {
    return a.sequence - b.sequence;
  }

  // Final fallback

  return a.createdAt - b.createdAt;
}

// ======================================================
// TOTAL ORDERING
// ======================================================

function getTotalOrder() {
  const result = [...messages];

  result.sort(compareTotalOrder);

  return result;
}

// ======================================================
// LAMPORT ORDERING
// ======================================================

function getLamportOrder() {
  const result = [...messages];

  result.sort(compareTotalOrder);

  return result;
}

// ======================================================
// GET SELECTED ORDER
// ======================================================

function getSelectedOrder() {
  const algorithm = document.getElementById("algorithm").value;

  if (algorithm === "fifo") {
    return getFIFOOrder();
  }

  if (algorithm === "causal") {
    return getCausalOrder();
  }

  if (algorithm === "total") {
    return getTotalOrder();
  }

  return getLamportOrder();
}

// ======================================================
// UPDATE ALL UI
// ======================================================

function updateAll() {
  updateClocks();

  updateMessageTable();

  updateMessageFlow();

  updateAlgorithmName();

  updateDeliveryOrder();

  updateCausalRelations();
}

// ======================================================
// UPDATE LAMPORT CLOCKS
// ======================================================

function updateClocks() {
  document.getElementById("clock-P1").innerText = lamportClock.P1;

  document.getElementById("clock-P2").innerText = lamportClock.P2;

  document.getElementById("clock-P3").innerText = lamportClock.P3;
}

// ======================================================
// UPDATE MESSAGE TABLE
// ======================================================

function updateMessageTable() {
  const table = document.getElementById("messageTable");

  table.innerHTML = "";

  messages.forEach(function (message) {
    const row = document.createElement("tr");

    const vector =
      `[${message.vector.P1}, ` +
      `${message.vector.P2}, ` +
      `${message.vector.P3}]`;

    row.innerHTML = `

                <td>
                    ${message.id}
                </td>

                <td>
                    ${message.sender}
                </td>

                <td>
                    ${message.receivers.join(", ")}
                </td>

                <td>
                    ${message.text}
                </td>

                <td>
                    ${message.lamport}
                </td>

                <td>
                    ${message.sequence}
                </td>

                <td>
                    ${vector}
                </td>

            `;

    table.appendChild(row);
  });
}

// ======================================================
// UPDATE MESSAGE FLOW
// ======================================================

function updateMessageFlow() {
  const flow = document.getElementById("messageFlow");

  if (messages.length === 0) {
    flow.innerText = "No messages yet";

    return;
  }

  const message = messages[messages.length - 1];

  const receivers = message.receivers.join(" + ");

  flow.innerHTML = `

        <strong>
            ${message.sender}
        </strong>

        &nbsp;

        ───────

        <strong>
            ${message.id}
        </strong>

        ───────>

        <strong>
            ${receivers}
        </strong>

        <div class="flow-message">

            "${message.text}"

        </div>

    `;
}

// ======================================================
// UPDATE DELIVERY ORDER
// ======================================================

function updateDeliveryOrder() {
  const delivery = document.getElementById("deliveryOrder");

  if (messages.length === 0) {
    delivery.innerText = "No messages";

    return;
  }

  const orderedMessages = getSelectedOrder();

  const result = orderedMessages.map((message) => message.id).join(" → ");

  delivery.innerText = result;

  updateStatus();
}

// ======================================================
// UPDATE ALGORITHM NAME
// ======================================================

function updateAlgorithmName() {
  const algorithm = document.getElementById("algorithm").value;

  const names = {
    lamport: "Lamport Ordering",

    fifo: "FIFO Ordering",

    causal: "Causal Ordering",

    total: "Total Ordering",
  };

  document.getElementById("selectedAlgorithm").innerText = names[algorithm];
}

// ======================================================
// UPDATE STATUS
// ======================================================

function updateStatus() {
  const status = document.getElementById("status");

  const algorithm = document.getElementById("algorithm").value;

  if (messages.length === 0) {
    status.innerText = "Waiting for messages...";

    return;
  }

  if (algorithm === "fifo") {
    status.innerText =
      "✓ FIFO preserves the sending order of messages from each individual sender.";
  } else if (algorithm === "causal") {
    status.innerText =
      "✓ Causal ordering preserves every happened-before relationship.";
  } else if (algorithm === "total") {
    status.innerText =
      "✓ Total ordering gives every message one deterministic global position.";
  } else {
    status.innerText =
      "✓ Messages are ordered using Lamport logical timestamps.";
  }
}

// ======================================================
// UPDATE HAPPENED-BEFORE RELATIONSHIPS
// ======================================================

function updateCausalRelations() {
  const container = document.getElementById("causalRelations");

  if (messages.length < 2) {
    container.innerHTML = "No causal relationships yet.";

    return;
  }

  let html = "";

  let relationshipFound = false;

  // ==============================================
  // CHECK EVERY MESSAGE PAIR
  // ==============================================

  for (let i = 0; i < messages.length; i++) {
    for (let j = i + 1; j < messages.length; j++) {
      const a = messages[i];

      const b = messages[j];

      // A -> B

      if (happenedBefore(a, b)) {
        html += `

                    <div class="relation">

                        <strong>
                            ${a.id}
                        </strong>

                        → happened-before →

                        <strong>
                            ${b.id}
                        </strong>

                    </div>

                `;

        relationshipFound = true;
      }

      // B -> A
      else if (happenedBefore(b, a)) {
        html += `

                    <div class="relation">

                        <strong>
                            ${b.id}
                        </strong>

                        → happened-before →

                        <strong>
                            ${a.id}
                        </strong>

                    </div>

                `;

        relationshipFound = true;
      }

      // Concurrent
      else if (areConcurrent(a, b)) {
        html += `

                    <div class="relation concurrent">

                        <strong>
                            ${a.id}
                        </strong>

                        || 

                        <strong>
                            ${b.id}
                        </strong>

                        → concurrent

                    </div>

                `;

        relationshipFound = true;
      }
    }
  }

  if (relationshipFound) {
    container.innerHTML = html;
  } else {
    container.innerHTML = "No relationships found.";
  }
}

// ======================================================
// ALGORITHM CHANGE
// ======================================================

document.getElementById("algorithm").addEventListener("change", function () {
  updateAlgorithmName();

  updateDeliveryOrder();
});

// ======================================================
// RESET SIMULATION
// ======================================================

function resetSimulation() {
  // Reset Lamport clocks

  lamportClock = {
    P1: 0,

    P2: 0,

    P3: 0,
  };

  // Reset Vector clocks

  vectorClock = {
    P1: createEmptyVector(),

    P2: createEmptyVector(),

    P3: createEmptyVector(),
  };

  // Reset messages

  messages = [];

  // Reset message ID

  messageCounter = 1;

  // Reset FIFO sequence

  senderSequence = {
    P1: 0,

    P2: 0,

    P3: 0,
  };

  // Update screen

  updateAll();
}

// ======================================================
// INITIAL UI
// ======================================================

updateAll();
