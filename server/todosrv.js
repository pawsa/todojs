/* This is the persistence server for the TODO demo application. The
 * following requests are supported:
GET /all - full list of items, together with content
GET /count - just the count.
GET /item/ID - specific item
GET /after/TICK - items modified at or after specific clock TICK.
GET /search/TEXT - items containing given string in 'text' property.

Item is an object with at least following properties: { 'id': 'ID',
 'tick': 'TICK', 'text': 'TEXT' }

New items are added with 
POST /item with {'text': 'TEXT'}. Server responds with full item content.

Items are updated with
PUT /item/ID with {'text': 'TEXT' } Server responds with full item content.

Items are deleted with
DELETE /item/ID . Server responds with full item content.

*/

var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');

var port = process.env.PORT || 8888;

function xinspect(o,i, depth){
    if (depth<=0) return o;
    if(typeof i=='undefined')i='';
    if(i.length>50)return '[MAX ITERATIONS]';
    var r=[];
    for(var p in o){
        var t=typeof o[p];
        r.push(i+'"'+p+'" ('+t+') => '+(t=='object' ? 'object:'+xinspect(o[p],i+'  ', depth-1) : o[p]+''));
    }
    return r.join(i+'\n');
}

function error(response, code, message) {
    response.writeHead(code, { 'Content-Type' : 'text/plain',
			 'Content-Length': message.length });
    response.end(message);
}

function returnJson(response, dict) {
    jresponse = JSON.stringify(dict);
    response.writeHead(200, { 'Content-Type' : 'application/json',
			      'Content-Length': jresponse.length });
    response.end(jresponse);
}

var dbName = '/tmp/todosrv.json';
var db;
try {
    db = JSON.parse(fs.readFileSync(dbName, 'utf8'));
} catch(e) {
    db = {
	'items': {},
	'maxid': 0,
	'lasttick': 0
    };
}

db.updateText = function (item, text) {
    item.text = text;
    var tick = Date.now();
    if (tick <= this.lasttick) {
	++this.lasttick;
    } else {
	this.lasttick = tick;
    }
    item.tick = this.lasttick;
}

process.on('SIGINT', function() {
    fs.writeFile(dbName, JSON.stringify(db), function(err) {
	if(err) {
	    return console.log(err);
	}
	console.log("The db was saved.");
	process.exit();
    });
}); 

var app = express();
app.use(bodyParser.json());

app.get('/count', function (req, res) {
    returnJson(res, {'count':  Object.keys(db.items).length});
});

app.post('/item', function (req, res) {
    if (req.body.text === '') {
	error(res, 400, 'Empty text');
	return;
    }
    var item = { 'id': ++db.maxid };
    db.updateText(item, req.body.text);
    db.items[item.id] = item;
    returnJson(res, item);
});

app.get('/item/:id', function (req, res) {
    var id = req.params.id;
    console.log('GET /item/' + id);
    if (req.params.id in db.items) {
	returnJson(res, db.items[id]);
    } else {
	error(res, 404, '{}');
    }
});

app.put('/item/:id', function (req, res) {
    var id = req.params.id;
    console.log('PUT /item/' + id);
    if (req.body.text === '') {
	error(res, 400, 'Empty text');
	return;
    }
    if (id in db.items) {
	db.updateText(db.items[id], req.body.text);
	returnJson(res, db.items[id]);
    } else {
	error(res, 404, '{}');
    }
});

app.delete('/item/:id', function (req, res) {
    var id = req.params.id;
    console.log('DELETE /item/' + id);
    if (id in db.items) {
	db.updateText(db.items[id], '');

	returnJson(res, db.items[id]);
    } else {
	error(res, 404, '{}');
    }
});

app.get('/after/:tick', function (req, res) {
    var tick = req.params.tick;
    console.log('GET /after/' + tick);
    var retdict = {};
    for(id in db.items) {
	if (db.items[id].tick > tick) {
	    retdict[id] = db.items[id];
	}
    }
    returnJson(res, retdict);
});


app.get('/search/:text', function (req, res) {
    var text = req.params.text;
    console.log('GET /search/' + text);
    if (req.body.text === '') {
	error(res, 400, 'Empty text');
	return;
    }
    var retdict = {};
    for(id in db.items) {
	if (db.items[id].text.indexOf(text) >= 0) {
	    retdict[id] = db.items[id];
	}
    }
    returnJson(res, retdict);
});

var server = app.listen(port);
