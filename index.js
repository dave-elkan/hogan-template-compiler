var fs = require('fs'),
    _ = require("underscore"),
    hogan = require('hogan.js'),
    defaults = {
        layoutsDirectory: __dirname + "/views/layouts",
        partialsDirectory: __dirname + "/views/partials",
        sharedTemplatesTemplate: __dirname + "/views/sharedTemplates.mustache"
    };

module.exports = function(options) {
    options = options || {};
    _.defaults(options, defaults); 
    
    // Remove utf-8 byte order mark, http://en.wikipedia.org/wiki/Byte_order_mark
    function removeByteOrderMark(text) {
       if (text && text.charCodeAt(0) === 0xfeff) {
           return text.substring(1);
       }
       return text;
    }

    /**
     * Reads a template file from the files system.
     * @param {String} file The path of the file to read.
     * @return {String} The contents of the file.
     */
    function readTemplateFile(file) {
        return removeByteOrderMark(fs.readFileSync(file, "utf8"));
    }

    /**
     * Reads hogan templates from the template directory.
     *
     * @param {String} templateDirectory The path to the template directory.
     */
    function readTemplates(templateDirectory) {
        var templates = [],
            fileList = fs.readdirSync(templateDirectory);

        fileList.forEach(function(file, i) {
            var fileName = getShortFileName(file),
                fileContents = readTemplateFile(templateDirectory + "/" + file);

            templates.push({
                id: fileName,
                contents: fileContents
            });
        });

        return templates;
    }

    /**
     * Compiles templates as strings of javascript.
     *
     * @param {Array} templates The list of templates as produced by the function readTemplates
     * @return {Array} An array of compiled stringified templates.
     */
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

    /**
     * Compiles the templates as strings and renders them into a javascript function via the
     * shareTemplates.mustache template file.
     *
     * @param templates The templates to
     * @return {*}
     */
    function renderStringifiedTemplates(templates) {
        var compiledTemplates = compileStringifiedTemplates(templates);
        return sharedTemplateTemplate.render({
            templates: compiledTemplates
        });
    }

    /**
     * Compiles a map of partials.
     *
     * @param templates {Array} The templates to add to the partials map.
     * @return {Object} A map of partials.
     */
    function compileTemplates(templates) {
        var partials = {};
        templates.forEach(function(template) {
            partials[template.id] = hogan.compile(template.contents);
        });

        return partials;
    }

    function compileTemplateFile(file) {
        return hogan.compile(readTemplateFile(file));
    }

    function getShortFileName(fileName) {
        var lastSlashIndex = fileName.lastIndexOf("/") + 1;
        return fileName.substr(lastSlashIndex, fileName.lastIndexOf(".") - lastSlashIndex);
    }

    var sharedTemplateTemplate,
        stringifiedTemplates,
        partials,
        layouts;

    /**
     * Initialise the template renderer.
     *
     * Compiles the Shared Template template file.
     * Reads the templates from the template directory.
     * Compiles a map of partials.
     * Renders a script containing the stringified templates which can be used in the browser.
     */
    function read() {
        sharedTemplateTemplate = compileTemplateFile(options.sharedTemplatesTemplate);

        var partialTemplates = readTemplates(options.partialsDirectory);
        partials = compileTemplates(partialTemplates);

        var layoutTemplates = readTemplates(options.layoutsDirectory);
        layouts = compileTemplates(layoutTemplates);
        stringifiedTemplates = renderStringifiedTemplates(partialTemplates);
    }

    function getPartial(name) {
        var fileName = getShortFileName(name),
            template = partials[fileName];

        return template;
    }

    function renderLayout(name, locals) {
        var layout = layouts[name];
        if (layout) {
            return layout.render(locals || {}, partials);
        }
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
        getTemplate: getPartial,
        getPartial: getPartial,
        renderLayout: renderLayout
    };
};
