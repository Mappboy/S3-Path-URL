let prevHref;
let prevHost;
let prevHostname;
let prevProtocol;

class S3Utils {
    static SETTINGS = {
        CUSTOM_PREFIX: "custom_prefix",
        CUSTOM_STYLE: "custom_style",
        BUCKETNAME: "bucketname",
        CUSTOMBUCKET: "custombucket",
        USE_CLOUDFRONT: "use_cloudfront",
        CLOUDFRONT_URL: "cloudfront_url"
    }
    static ID = 's3-path-url'

    static initialize(){
        if (!game.modules.get('lib-wrapper')?.active) {
            if(game.user.isGM){
                ui.notifications.error("Module S3 Custom URL requires the 'libWrapper' module. Please install and activate it.");
            }
            return;
        }

        //Register Setting

        this.registerSettings();

        //Register Wrappers

        this.registerWrappers();
    }

    static overrideData(){
        if (!game.modules.get('lib-wrapper')?.active) {
            return;
        }

        if(game.settings.get(this.ID, this.SETTINGS.CUSTOM_STYLE)){
            prevHref = game.data.files.s3.endpoint.href;
            prevHost = game.data.files.s3.endpoint.host;
            prevHostname = game.data.files.s3.endpoint.hostname;
            prevProtocol = game.data.files.s3.endpoint.protocol;

            // Do not override endpoint if Cloudfront CDN is being used
            if (!game.settings.get(this.ID, this.SETTINGS.USE_CLOUDFRONT)) {
                game.data.files.s3.endpoint.hostname = game.settings.get(this.ID, this.SETTINGS.CUSTOM_PREFIX).split("//")[1];
                game.data.files.s3.endpoint.host = game.settings.get(this.ID, this.SETTINGS.CUSTOM_PREFIX).split("//")[1];
                game.data.files.s3.endpoint.href = game.settings.get(this.ID, this.SETTINGS.CUSTOM_PREFIX);
                game.data.files.s3.endpoint.protocol = game.settings.get(this.ID, this.SETTINGS.CUSTOM_PREFIX).split('//')[0];
            }
        }

    }

    static registerSettings(){
        game.settings.register(this.ID, this.SETTINGS.CUSTOM_PREFIX, {
            name: `S3_PATH_URL.settings.${this.SETTINGS.CUSTOM_PREFIX}.Name`,
            default: "https://url.to.endpoint.com",
            type: String,
            scope: 'world',
            config: true,
            hint: `S3_PATH_URL.settings.${this.SETTINGS.CUSTOM_PREFIX}.Hint`,
            requiresReload: true
        });
        game.settings.register(this.ID, this.SETTINGS.BUCKETNAME, {
            name: `S3_PATH_URL.settings.${this.SETTINGS.BUCKETNAME}.Name`,
            type: String,
            scope: 'world',
            default: 'foundry',
            config: true,
            hint: `S3_PATH_URL.settings.${this.SETTINGS.BUCKETNAME}.Hint`,
            requiresReload: true
        });

        game.settings.register(this.ID, this.SETTINGS.CUSTOM_STYLE, {
            name: `S3_PATH_URL.settings.${this.SETTINGS.CUSTOM_STYLE}.Name`,
            default: false,
            type: Boolean,
            scope: 'world',
            config: true,
            hint: `S3_PATH_URL.settings.${this.SETTINGS.CUSTOM_STYLE}.Hint`,
            requiresReload: true
        });
        game.settings.register(this.ID, this.SETTINGS.CUSTOMBUCKET, {
            name: `S3_PATH_URL.settings.${this.SETTINGS.CUSTOMBUCKET}.Name`,
            default: false,
            type: Boolean,
            scope: 'world',
            config: true,
            hint: `S3_PATH_URL.settings.${this.SETTINGS.CUSTOMBUCKET}.Hint`,
            requiresReload: true
        });

        game.settings.register(this.ID, this.SETTINGS.USE_CLOUDFRONT, {
            name: `S3_PATH_URL.settings.${this.SETTINGS.USE_CLOUDFRONT}.Name`,
            default: false,
            type: Boolean,
            scope: 'world',
            config: true,
            hint: `S3_PATH_URL.settings.${this.SETTINGS.USE_CLOUDFRONT}.Hint`,
            requiresReload: true
        });

        game.settings.register(this.ID, this.SETTINGS.CLOUDFRONT_URL, {
            name: `S3_PATH_URL.settings.${this.SETTINGS.CLOUDFRONT_URL}.Name`,
            default: "https://d123.cloudfront.net",
            type: String,
            scope: 'world',
            config: true,
            hint: `S3_PATH_URL.settings.${this.SETTINGS.CLOUDFRONT_URL}.Hint`,
            requiresReload: true
        });
    }

    static registerWrappers(){
        const filePickerPath = foundry.applications?.apps?.FilePicker ? "foundry.applications.apps.FilePicker" : "FilePicker";

        libWrapper.register(this.ID, `${filePickerPath}.upload`, async function (wrapped, ...args) {
            let result = await wrapped(...args);
            if (args[0] === "s3" && !!result.path) {
                result.path = S3Utils.transformURL(result.path);
            }
            return result;
        }, libWrapper.WRAPPER);
        libWrapper.register(this.ID, `${filePickerPath}.browse`, async function (wrapped, ...args) {
            let result = await wrapped(...args);
            if (args[0] === "s3") {
                result.files?.forEach((file, index) => {
                    result.files[index] = S3Utils.transformURL(file);
                });
            }
            return result;
        }, libWrapper.WRAPPER);
        libWrapper.register(this.ID, `${filePickerPath}.matchS3URL`, function (wrapped, ...args){
            let result = wrapped(...args);
            if(result){
                if (game.settings.get('s3-path-url', "custom_style")&&game.settings.get('s3-path-url', "custombucket")){
                    let bucketName = game.settings.get('s3-path-url', "bucketname");
                    if(result.groups.bucket !== bucketName){
                        result.groups.key = result.groups.bucket + "/" + result.groups.key;
                        result.groups.bucket = bucketName;
                    }
                }
            }
            return result;
        }, libWrapper.WRAPPER);
        if (game.modules.get('moulinette-core')?.active) {
            libWrapper.register(this.ID, "game.moulinette.applications.MoulinetteFileUtil.getBaseURL", async function (wrapped, ...args){
                let result = await wrapped(...args);
                if(result !== "" && result){
                    result = S3Utils.transformURL(result);
                }
                return result;
            });
        }
    }

    /**
     *
     * @param {string} url
     * @returns string
     */
    static transformURL(url) {
        if(game.settings.get('s3-path-url', this.SETTINGS.CUSTOM_STYLE)) {
            const splitHref = prevHref.split('//')
            const isCloudfront = game.settings.get('s3-path-url', this.SETTINGS.USE_CLOUDFRONT);
            let baseUrl = isCloudfront 
                ? game.settings.get('s3-path-url', this.SETTINGS.CLOUDFRONT_URL) 
                : game.data.files.s3.endpoint.href;
                
            // Ensure baseUrl ends with a slash if we're constructing paths with it later
            if (baseUrl && !baseUrl.endsWith('/')) {
                baseUrl += '/';
            }

            if (url.startsWith(prevHref)) {
                let formattedUrl = url.replace(prevHref, baseUrl);
                
                if (isCloudfront) {
                    let bucketName = game.settings.get('s3-path-url', this.SETTINGS.BUCKETNAME);
                    if (bucketName) {
                        // Strip the bucket name and following slash from the Cloudfront URL path
                        formattedUrl = formattedUrl.replace(`${baseUrl}${bucketName}/`, baseUrl);
                    }
                }
                
                return formattedUrl;
            }
            if (url.includes(splitHref[1])){
                // if URL has been mangled by some other module, discard anything before the href without the protocol.
                let path = url.split(splitHref[1])[1]
                path = path.startsWith("/") ? path : "/" + path;
                
                let formattedUrl = baseUrl + path.substring(1); // remove leading slash from path since baseUrl has it

                if (isCloudfront) {
                    let bucketName = game.settings.get('s3-path-url', this.SETTINGS.BUCKETNAME);
                    if (bucketName) {
                        // Strip the bucket name from the reconstructed path
                        formattedUrl = formattedUrl.replace(`${baseUrl}${bucketName}/`, baseUrl);
                    }
                }

                return formattedUrl;
            }
        }

        return url;
    }
}

Hooks.once('init', async function () {
    S3Utils.initialize();
});

Hooks.once('ready', async function (){
    S3Utils.overrideData();
});

let S3Utilss = {
    createS3URL: S3Utils.createS3URL
}

window.S3Utils = S3Utilss;
