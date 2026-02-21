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

async function createAdmin() {
    const hash = await bcrypt.hash("admin123", 10);

    db.query(
        "INSERT INTO admin(username,password) VALUES(?,?)",
        ["admin", hash]
    );
}

createAdmin();
function isAdmin(req,res,next){
    if(req.session.admin && req.session){
        return next();
    }
    res.redirect("/admin/login");
}
// Test route
app.get('/', (req, res) => {
  res.send("Quotation App is Running");
});
// Admin Routes

app.get("/admin/dashboard", isAdmin, (req,res)=>{

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

app.get('/admin/add-product', (req,res) => {
  db.query("SELECT * FROM categories", (err,results) => {
    if (err){
      console.log(err);
      return res.send("Database Error")
    }
    // Else send data
    return res.render('add_product', { categories: results,success: req.flash("success"), error: req.flash("error")})
  });
  
});

app.post('/admin/add-product', (req, res) => {

  const { serial, name, cPrice, cost, category } = req.body;

  db.query(
    `INSERT INTO products 
     (serial_no, description, price, cost, category_id)
     VALUES (?, ?, ?, ?, ?)`,
    [serial, name, cPrice, cost, category],
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

            res.redirect("/admin/dashboard");
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

            res.redirect("/admin/dashboard");
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
            res.redirect("/admin/dashboard");
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
app.get("/quotation/download",(req,res)=>{

    const doc = new PDFDocument();

    res.setHeader(
        "Content-Disposition",
        "attachment; filename=quotation.pdf"
    );
    doc.font('Times-Roman')
    doc.fontSize(20);
    doc.text(`Quotation`, {
      align:'center'
    })
    doc.end();

    doc.pipe(res);
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});