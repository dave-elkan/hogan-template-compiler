var fs = require('fs'),
    _ = require("underscore"),
    hogan = require('hogan.js'),
    defaults = {
        templateDirectory: __dirname + "/views",
        sharedTemplatesTemplate: __dirname + "/views/sharedTemplates.mustache"
    };

module.exports = function(options) {
    options = options || {};
    _.defaults(options, defaults); 

    
    // Remove utf-8 byte order mark, http://en.wikipedia.org/wiki/Byte_order_mark
    function removeByteOrderMark(text) {
       if (text.charCodeAt(0) === 0xfeff) {
           return text.substring(1);
       }
       return text;
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
        var partials = [];
        forEachFileInDirectory(templateDirectory, function(fileName, fileContents) {
            partials.push({
                id: fileName,
                contents: fileContents
            });
        });

        return partials;
    }

    function compileStringifiedTemplates(templates) {
        var compiledTemplates = [];
        templates.forEach(function(template, i) {
            compiledTemplates.push({
                id: template.id,
                script: compile(template.contents, {
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
            partials[template.id] = compile(template.contents);
        });

        return partials;
    }

    function compile(templateContents, options) {
       return hogan.compile(templateContents, options);
    }

    function compileTemplateFile(file) {
        return compile(readTemplateFile(file));
    }

    function getShortFileName(fileName) {
        var lastSlashIndex = fileName.lastIndexOf("/") + 1;
        return fileName.substr(lastSlashIndex, fileName.lastIndexOf(".") - lastSlashIndex);
    }

    var sharedTemplateTemplate,
        stringifiedTemplates,
        partials;

    function read() {
        sharedTemplateTemplate = compileTemplateFile(options.sharedTemplatesTemplate);

        var templates = readTemplates(options.templateDirectory);
        partials = compilePartials(templates);
        stringifiedTemplates = renderStringifiedTemplates(compileStringifiedTemplates(templates));
    }

    read();

    return {
        read: read,
        compileTemplateFile: compileTemplateFile,
        getPartials: function() {
            return partials;
        },
        getSharedTemplates: function() {
            return stringifiedTemplates;
        },
        getTemplate: function(file) {
            var fileName = getShortFileName(file),
                template = partials[fileName];

            return template;
        }
    };
};
