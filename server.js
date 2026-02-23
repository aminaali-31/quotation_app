require('dotenv').config();
const express = require('express');
const db = require('./config/db');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require("bcrypt");
const PDFDocument = require("pdfkit");
const app = express();

app.set("view engine" , "ejs");
app.set("views", path.join(__dirname,"views"));
app.use(express.static(path.join(__dirname,"public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: "thisismysecrectkeyfortesting",
    resave: false,
    saveUninitialized: false
}));

app.use(flash());

function isAdmin(req,res,next){
    if(req.session.admin && req.session){
        return next();
    }
    res.redirect("/admin/login");
}
// ROutes
app.get('/', (req, res) => {
    db.query(`
        SELECT 
            quote_no,
            title,
            grand_total,
            last_updated
        FROM quotations
        WHERE is_published = 1
        ORDER BY last_updated DESC;
    `,
    (err, quotations) => {
        if(err){
            console.log(err);
            return res.status(500).send("Database error");
        }
        res.render('quote-list', { quotations });
    });
});

app.get('/quotations/:id', (req, res) => {
    db.query(
    `SELECT id, quote_no, title, grand_total , last_updated
     FROM quotations 
     WHERE quote_no = ? AND is_published = 1`,
    [req.params.id],
    (err, quotationResult) => {
        if (err) throw err;

        if (!quotationResult.length) {
            return res.render('quote-detail', {
                quotation: null,
                items: [],
                total: 0
            });
        }

        const quotationId = quotationResult[0].id; // ⭐ IMPORTANT

        db.query(
            `SELECT 
                qi.name,
                qi.category,
                qi.qty,
                p.price
             FROM quotation_items qi
             LEFT JOIN products p 
             ON p.serial_no = qi.product_id
             WHERE qi.quote_id = ?`,
            [quotationId], // ✅ use primary key id
            (err, items) => {
                if (err) throw err;
                let total = items.reduce((sum, item) =>
                    sum + ((item.price || 0) * (item.qty || 0)),
                0);
                res.render('quote-detail', {
                    quotation: quotationResult[0],
                    items,
                    total
                });
            });
    });
});

app.post("/quotation/save", (req, res) => {
    const { quote_no, grand_total ,title, margin, profit, is_published, items } = req.body;
    const insertQuotation = `
        INSERT INTO quotations 
        (quote_no, grand_total ,title, margin, profit, is_published)
        VALUES (?, ?,?, ?, ?, ?)
    `;
    // Insert quotation header first
    db.query(insertQuotation,
        [quote_no, grand_total,title, margin, profit, is_published],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ message: "Quotation save failed" });
            }
            const quoteId = result.insertId;
            // If no items → return response
            if (!items || Object.keys(items).length === 0) {
                return res.json({ message: "Quotation saved successfully" });
            }
            let queries = [];
            // Prepare item insert queries
            for (let category in items) {
                for (let product of items[category]) {
                    queries.push(new Promise((resolve, reject) => {
                        db.query(
                            `INSERT INTO quotation_items 
                            (quote_id, product_id, name, category, qty, price, cost)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                quoteId,
                                product.id,
                                product.name,
                                category,
                                product.qty,
                                product.price,
                                product.cost
                            ],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    }));
                }
            }
            // Execute all item inserts
            Promise.all(queries)
                .then(() => {
                    res.json({
                        success: true,
                        message: "Quotation saved successfully"
                    });
                })
                .catch(err => {
                    console.log(err);
                    res.status(500).json({
                        success: false,
                        message: "Item save failed"
                    });
                });
        });
});
// Admin Routes
app.get("/admin", isAdmin, (req,res)=>{

    db.query(`SELECT products.*, categories.name AS category_name
              FROM products
              LEFT JOIN categories
              ON products.category_id = categories.id;`, (err,results)=>{

        if(err){
            console.error(err);
            return res.send("Database error");
        }

        res.render("dashboard",{
            products: results
        });

    });

});

app.get('/admin/quotations',isAdmin, (req,res) => {
    db.query(`
        SELECT * FROM quotations
        ORDER BY created_at`,

        (err,quotations) => {
            if(err){
                console.log(err);
                return res.status(500).send("Database error");
            }
            res.render('quote-list', { quotations });
    });
});

app.get('admin/quotations/:id',isAdmin, (req, res) => {
    db.query(
    `SELECT id, quote_no, title, grand_total , last_updated
     FROM quotations 
     WHERE quote_no = ?`,
    [req.params.id],
    (err, quotationResult) => {
        if (err) throw err;

        if (!quotationResult.length) {
            return res.render('quote-detail', {
                quotation: null,
                items: [],
                total: 0
            });
        }

        const quotationId = quotationResult[0].id; // ⭐ IMPORTANT

        db.query(
            `SELECT 
                qi.name,
                qi.category,
                qi.qty,
                p.price
             FROM quotation_items qi
             LEFT JOIN products p 
             ON p.serial_no = qi.product_id
             WHERE qi.quote_id = ?`,
            [quotationId], // ✅ use primary key id
            (err, items) => {
                if (err) throw err;
                let total = items.reduce((sum, item) =>
                    sum + ((item.price || 0) * (item.qty || 0)),
                0);
                res.render('admin-quote', {
                    quotation: quotationResult[0],
                    items,
                    total
                });
            });
    });
});
app.get('/admin/add-product',isAdmin, (req,res) => {
  db.query("SELECT * FROM categories", (err,results) => {
    if (err){
      console.log(err);
      return res.send("Database Error")
    }
    // Else send data
    return res.render('add_product', { categories: results,success: req.flash("success"), error: req.flash("error")})
  });
  
});

app.post('/admin/add-product', isAdmin,(req, res) => {

  const { name, cPrice, cost, category } = req.body;

  db.query(
    `INSERT INTO products 
     (description, price, cost, category_id)
     VALUES ( ?, ?, ?, ?)`,
    [name, cPrice, cost, category],
    (err) => {
      if (err) {
        console.log(err);
        return res.send(err.message);
      }
      req.flash("success", "Product added successfully");
      return res.redirect('/admin/add-product');
    }
  );

});
app.get("/admin/delete-product/:id", isAdmin, (req,res)=>{

    const id = req.params.id;

    db.query(
        "DELETE FROM products WHERE serial_no=?",
        [id],
        (err)=>{
            if(err){
                console.error(err);
                return res.send("Delete error");
            }

            res.redirect("/admin");
        }
    );

});
app.get("/admin/edit-product/:id", isAdmin, (req,res)=>{

    const id = req.params.id;
    db.query(
        "SELECT * FROM products WHERE serial_no=?",
        [id],
        (err,results)=>{
            if(err) return res.send("Database error");
            db.query("SELECT * FROM categories",(err2,categories)=>{

                res.render("edit_product",{
                    product: results[0],
                    categories: categories
                });

            });

        }
    );

});
app.post("/admin/update-product/:id", isAdmin, (req,res)=>{

    const id = req.params.id;

    const {description, price, cost, category} = req.body;

    db.query(
        `UPDATE products
         SET description=?, price=?, cost=?, category_id=?
         WHERE serial_no=?`,
        [description, price, cost, category, id],
        (err)=>{

            if(err){
                console.error(err);
                return res.send("Update error");
            }

            res.redirect("/admin");
        }
    );

});
app.get("/admin/login", (req,res)=>{
    return res.render('login');
})
app.post("/admin/login", (req,res)=>{

    const {username,password} = req.body;

    db.query(
        "SELECT * FROM admin WHERE username=?",
        [username],
        async (err,results)=>{

            if(err || results.length === 0){
                return res.send("Invalid username");
            }

            const admin = results[0];

            const match = await bcrypt.compare(
                password,
                admin.password
            );

            if(!match){
                return res.send("Invalid password");
            }

            req.session.admin = admin;
            res.redirect("/admin");
        }
    );

});
app.get("/admin/quotation", isAdmin, (req,res)=>{

    const query = `
    SELECT products.*, categories.name AS category_name
    FROM products
    LEFT JOIN categories
    ON products.category_id = categories.id
    ORDER BY categories.name
    `;
    db.query(query,(err,results)=>{

        if(err){
            console.error(err);
            return res.send("Database error");
        }
        // Group products by category
        const grouped = {};
        results.forEach(p=>{
            if(!grouped[p.category_name]){
                grouped[p.category_name] = [];
            }
            grouped[p.category_name].push(p);
        });
        res.render("quotation",{
            products: grouped
        });

    });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});