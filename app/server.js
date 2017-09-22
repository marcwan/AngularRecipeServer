var express = require('express');
var app = express();
var morgan = require('morgan'),
    async = require('async'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    path = require('path'),
    multer = require('multer');

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

var upload = multer({ dest: "uploads/" });
app.use(morgan('dev'));
app.use(cookieParser('catsonkeyboard'));

// Parse application/x-www-form-urlencoded & JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var _recipesList;
var _writingRecipes;

_recipesList = JSON.parse(fs.readFileSync('./recipes.json'));


app.use(express.static(__dirname + "/../static"));


app.get('/v1/recipes.json', (req, res) => {
    console.log(_recipesList);
    send_success(res, _recipesList);
});

app.put('/v1/recipes.json', (req, res) => {
    var recipe_to_add = JSON.parse(JSON.stringify(req.body));
    var id = getNewRecipeId();
    recipe_to_add.id = id;
    recipe_to_add.date_added = new Date().toISOString();
    recipe_to_add.date_last_modified = new Date().toISOString();
    if (!req.body.keywords) {
        req.body.keywords = [];
    }

    _recipesList.push(recipe_to_add);
    saveRecipes();
    send_success(res, recipe_to_add);
});
app.get('/v1/recipes/:recipe_id.json', (req, res) => {
    for (const recipe of _recipesList) {
        if (recipe.id == req.params.recipe_id) {
            send_success(res, recipe);
            return;
        }
    }

    send_failure(res, 404, no_such_recipe());
});

app.post('/v1/recipes/:recipe_id/images', upload.any(), (req, res) => {
    const recipe = getRecipeById(req.params.recipe_id);
    if (!recipe) {
        send_failure(req, 404, no_such_recipe());
        return;
    }

    console.log(req.files);

    // First, clear out anything we already have.
    recipe.cover_photo = null;
    if (recipe.instructions) {
        for (instruction of recipe.instructions) {
            instruction.photo = null;
        }
        // UNDONE(marcwan): DELETE ALL EXISTING IMAGES !!!!
    }

    if (!req.files) {
        saveRecipes();
        send_success(res, recipe);
        return;
    }

    if (req.files.length > 1 && (!recipe.instructions || !recipe.instructions.length)) {
        send_failure(res, 400, invalid_image_target());
        return;
    }

    // Start with the cover image.
    async.eachSeries(req.files, function (file, cb) {
        // Otherwise, we're good so udpate the file data for this recipe.
        const extension = path.extname(file.originalname);
        if (!acceptableExtension(extension)) {
            fs.unlink(file.path);
            cb(unacceptable_file_type());
            return;
        }
        const final_fn = file.filename + extension;

        if (file.fieldname == "cover_photo") {
            recipe.cover_photo = final_fn;
        } else if (file.fieldname.indexOf("preparation_photos_") == 0) {
            const index = parseInt(file.fieldname.split("_")[2], 10);
            if (isNaN(index) || index < 0 || index > recipe.instructions.length) {
                fs.unlink(file.path);
                cb(invalid_image_target());
                return;
            }

            recipe.instructions[index].photo = final_fn;
        } else {
            fs.unlink(file.path);
            cb(invalid_image_target());
            return;
        }

        fs.rename(file.path, '../static/images/' + final_fn, cb);
    },
    function (err) {
        if (err) {
            send_failure(res, 400, err);
        } else {
            saveRecipes();
            send_success(res, recipe);
        }
    });
});

app.post('/v1/recipes/:recipe_id.json', (req, res) => {
});
app.delete('/v1/recipes/:recipe_id.json', (req, res) => {
});


function make_error(err, msg) {
    var e = new Error(msg);
    e.code = err;
    return e;
}


function send_success(res, data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    var output = { error: null, data: data };
    res.end(JSON.stringify(output) + "\n");
}


function send_failure(res, server_code, err) {
    var code = (err.code) ? err.code : err.name;
    res.writeHead(server_code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: code, message: err.message }) + "\n");
}


function invalid_resource() {
    return make_error("invalid_resource",
        "the requested resource does not exist.");
}

function cant_save_files() {
    return make_error("cant_save_files",
        "Unable to save one or more files to the server.");
}
function no_such_recipe() {
    return make_error("no_such_recipe",
        "The specified recipe does not exist");
}

function unacceptable_file_type() {
    return make_error("unacceptable_file_type",
        "That's not a supported image file type.");
}
function invalid_image_target() {
    return make_error("invalid_image_target",
        "The specified photo wasn't for a cover photo or known preparation photo.");
}


function get_recipe_name(req) {
    return req.params.recipe_name;
}
function get_template_name(req) {
    return req.params.template_name;
}
function get_query_params(req) {
    return req.query;
}
function get_page_name(req) {
    return req.params.page_name;
}

app.listen(8080);



function getRecipeById(id) {
    for (const recipe of _recipesList) {
        if (recipe.id == id) {
            return recipe;
        }
    }
    return null;
}

function getNewRecipeId() {
    let max = 0;
    for (const recipe of _recipesList) {
        console.log(recipe);
        if (recipe.id > max) {
            max = recipe.id;
        }
    }

    return max + 1;
}


function saveRecipes() {
    if (_writingRecipes) {
        return;
    }

    _writingRecipes = true;

    fs.writeFile('./recipes.json', JSON.stringify(_recipesList, null, 2), (err) => {
        _writingRecipes = false;

        if (err) {
            console.log('WRITING RECIPE LIST FAILED:');
            console.log(JSON.stringify(err, null, 2));
        }
    });
}


function acceptableExtension(ext) {
    switch (ext.toLowerCase()) {
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.bmp':
        case '.gif':
        case '.tif':
        case '.tiff':
            return true;
    }
    return false;
}
