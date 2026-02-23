let cart = {};
let totalCost = 0;
let totalPrice = 0;
let profit = 0;
let margin = 0;
/* ------------------------------
   Add Product to Category Cart
--------------------------------*/
function addProduct(selectElement, category) {

    let option = selectElement.options[selectElement.selectedIndex];
    if (!option.value) return;

    let product = {
        id: Number(option.dataset.id),
        name: option.dataset.name,
        price: parseFloat(option.dataset.price),
        cost: parseFloat(option.dataset.cost),
        qty: 1
    };

    // Create category cart if not exists
    if (!cart[category]) {
        cart[category] = [];
    }

    cart[category].push(product);

    renderProductList(category);
    calculateTotals();
    selectElement.value = "";
}

/* ------------------------------
   Render Category Product List
--------------------------------*/
function renderProductList(category) {

    let listDiv = document.getElementById("list-" + category);
    listDiv.innerHTML = "";

    let products = cart[category] || [];

    products.forEach(product => {

        let div = document.createElement("div");
        div.className = "product-row";
        div.style.marginBottom = "8px";

        div.innerHTML = `
            <span style="display:flex; flex-direction:column;">
            <span style="flex:2;">${product.name}</span>
            <span><strong>Price:</strong> ${product.price.toLocaleString()}</span>
            <span><strong>Cost:</strong> ${product.cost.toLocaleString()}</span>
            </span>
            <span>
            <label>Qty:</label>
             <input type="number"
                   min="1"
                   value="${product.qty}"
                   style="width:30px;height:30px;"
                   onchange="updateQty('${category}', ${product.id}, this.value)" />
            <button onclick="removeProduct('${category}', ${product.id})">X</button>
            </span>
        `;

        listDiv.appendChild(div);
    });
}
/* ------------------------------
   Remove Product
--------------------------------*/

function updateQty(category, id, qty) {

    qty = parseInt(qty);
    if (qty < 1 || isNaN(qty)) qty = 1;

    let products = cart[category];
    if (!products) return;

    let product = products.find(p => p.id === id);
    if (product) product.qty = qty;

    calculateTotals();
}
function removeProduct(category, id) {
    cart[category] = (cart[category] || [])
        .filter(p => p.id !== id);

    renderProductList(category);
    calculateTotals();
}
/* ------------------------------
   Calculate Summary Metrics
--------------------------------*/
function calculateTotals() {

    totalCost = 0;
    totalPrice = 0;

    Object.values(cart).forEach(products => {

        products.forEach(p => {
            totalCost += p.cost * p.qty;
            totalPrice += p.price * p.qty;
        });

    });

    profit = totalPrice - totalCost;
    margin = totalPrice ? ((profit / totalPrice) * 100) : 0;

    document.getElementById("totalCost").innerText =
        totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById("totalPrice").innerText =
        totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById("profit").innerText =
        profit.toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById("margin").innerText =
        margin.toLocaleString(undefined, { minimumFractionDigits: 2 }) + "%";
}

/* ------------------------------
   Download Quotation
--------------------------------*/
function downloadQuotation() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let rows = [];
    totalCost = 0;
    totalPrice = 0;
    const quotationNumber = "QT-" + Date.now();
    const date = new Date().toLocaleDateString();
    const companyName = "Your Company Name";
    const companyAddress = "Your Address Line";
    const companyPhone = "+92-XXX-XXXXXXX";
    // Convert cart object into table rows
    Object.keys(cart).forEach(category => {

        cart[category].forEach(product => {

            let subtotalPrice = product.price * product.qty;
            let subtotalCost = product.cost * product.qty;

            totalCost += subtotalCost;
            totalPrice += subtotalPrice;

            rows.push([
                category,
                product.name,
                product.qty,
                product.price.toLocaleString(),
                subtotal.Price.toLocaleString()
            ]);
        });

    });


    // Title
    doc.setFontSize(18);
    doc.text(companyName, 14, 20);

    doc.setFontSize(10);
    doc.text(companyAddress, 14, 26);
    doc.text(companyPhone, 14, 31);

    doc.setFontSize(14);
    doc.text("QUOTATION", 150, 20);

    doc.setFontSize(10);
    doc.text("Quotation No: " + quotationNumber, 150, 26);
    doc.text("Date: " + date, 150, 31);

    // Table
    doc.autoTable({
        startY: 70,
        head: [["Category", "Product", "Qty", "Unit Price", "Line Total"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 9 }
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    // Summary
    doc.setFontSize(12);
    doc.text(`Total Price: ${totalPrice.toLocaleString()}`, 14, finalY);
    
    doc.line(14, finalY + 35, 70, finalY + 35);
    doc.text("Authorized Signature", 14, finalY + 40);

    // ======= Footer =======
    doc.setFontSize(8);
    doc.text("Thank you for your business.", 14, 285);

    doc.save("Quotation-" + quotationNumber + ".pdf");
}
async function saveQuotation() {
    const isPublished = document.getElementById("publishCheckbox").checked ? 1 : 0;
    const title = document.getElementById('title').value;
    const response = await fetch("/quotation/save", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            quote_no: "QT-" + Date.now(),
            grand_total: totalPrice,
            title:title,
            margin: margin,
            profit: profit,
            is_published: isPublished,
            items: cart
        })
    });

    const data = await response.json();

    alert(data.message);

    if(data.success){

        // Clear cart
        cart = {};

        // Clear inputs
        document.querySelectorAll("input").forEach(input=>{
            input.value = "";
        });

        document.querySelectorAll("select").forEach(select=>{
            select.value = "";
        });

        // Redirect
        window.location.href = "/admin/quotation";
    }
}