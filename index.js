var fs = require('fs'),
    _ = require("underscore"),
    hogan = require('hogan.js'),
    defaults = {
        partialsDirectoryName: "partials",
        sharedTemplateTemplate: __dirname + "/views/sharedTemplates.mustache"
    };

module.exports = function(app, options) {
    options = options || {};
    _.defaults(options, defaults); 

    var sharedTemplateTemplate = readSharedTemplatesTemplate();
    
    // Remove utf-8 byte order mark, http://en.wikipedia.org/wiki/Byte_order_mark
    function removeByteOrderMark(text) {
       if (text.charCodeAt(0) === 0xfeff) {
           return text.substring(1);
       }
       return text;
    }

    function readSharedTemplatesTemplate() {
        return hogan.compile(readTemplateFile(options.sharedTemplateTemplate));
    }

    function readTemplateFile(file) {
        return removeByteOrderMark(fs.readFileSync(file, "utf8"));
    }

    function forEachFileInDirectory(directory, callback) {
        var fileList = fs.readdirSync(directory);
        fileList.forEach(function(file, i) {
            var fileName = getShortFileName(file),
                fileContents = readTemplateFile(directory + "/" + file);

            callback(fileName, fileContents);
        });
    }
    
    /**
     * Reads and compiles hogan templates from the shared template 
     * directory to stringified javascript functions.
     */
    function readTemplates(templateDirectory) {
        var sharedTemplateDirectory = templateDirectory + "/" + options.partialsDirectoryName;
        var sharedTemplates = [];
        forEachFileInDirectory(sharedTemplateDirectory, function(fileName, fileContents) {
            sharedTemplates.push({
                id: fileName,
                contents: fileContents
            });
        });

        return sharedTemplates;
    }

    function compileStringifiedTemplates(templates) {
        var compiledTemplates = [];
        templates.forEach(function(template, i) {
            compiledTemplates.push({
                id: template.id,
                script: hogan.compile(template.contents, {
                    asString: true
                }),
                last: i === templates.length - 1
            });
        });

        return compiledTemplates;
    }

    function renderStringifiedTemplates(templates) {
       return sharedTemplateTemplate.render({
           templates: templates
       });
    }

    function compilePartials(templates) {
        var partials = {};
        templates.forEach(function(template) {
            partials[template.id] = hogan.compile(template.contents);
        });

        return partials;
    }

    function getShortFileName(fileName) {
        var lastSlashIndex = fileName.lastIndexOf("/") + 1;
        return fileName.substr(lastSlashIndex, fileName.lastIndexOf(".") - lastSlashIndex);
    }

    var templates,
        stringifiedTemplates,
        partials;

    function compileTemplates() {
        templates = readTemplates(app.settings.views);
        partials = compilePartials(templates);
        stringifiedTemplates = renderStringifiedTemplates(compileStringifiedTemplates(templates));
    }

    function readTemplatesMiddleware(req, res, next) {
        sharedTemplateTemplate = readSharedTemplatesTemplate();
        compileTemplates();
        next();
    }

    compileTemplates();

    if (app.settings.env === "development") {
        app.use(readTemplatesMiddleware);
    }
    
    return {
        compiler: {
            compile: function(source, options) {
                var fileName = getShortFileName(options.filename),
                    template = partials[fileName];
                
                if (!template) {
                    partials[fileName] = template = hogan.compile(source);
                }

                return function(locals) {
                    return template.render(locals, partials);
                };
            }
        },

        getSharedTemplates: function() {
            return stringifiedTemplates;
        }
    }
};
