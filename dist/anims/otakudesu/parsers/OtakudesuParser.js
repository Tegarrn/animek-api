"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dataFetcher_1 = require("../../../services/dataFetcher");
const lruCache_1 = require("../../../libs/lruCache");
const OtakudesuParserExtra_1 = __importDefault(require("./OtakudesuParserExtra"));

class OtakudesuParser extends OtakudesuParserExtra_1.default {
    // ... (metode parseHome, parseSchedule, parseAllAnimes, parseAllGenres, 
    // parseOngoingAnimes, parseCompletedAnimes, parseSearch, parseGenreAnimes tetap sama 
    // kecuali jika Anda ingin menambahkan logging di dalam callback 'this.scrape' mereka juga,
    // mengikuti pola di parseAnimeDetails)

    parseAnimeDetails(animeId) {
        console.log(`[OtakudesuParser] Attempting to parse details for animeId: ${animeId}`);
        return this.scrape({
            path: `/anime/${animeId}`,
            initialData: {
                title: "",
                poster: "",
                japanese: "",
                score: "",
                producers: "",
                type: "",
                status: "",
                episodes: 0, // Diubah dari null agar konsisten, atau sesuaikan dengan tipe
                duration: "",
                aired: "",
                studios: "",
                batch: null,
                synopsis: { paragraphs: [], connections: [] },
                genreList: [],
                episodeList: [],
                recommendedAnimeList: [],
            },
        }, async ($, data) => {
            try {
                console.log(`[OtakudesuParser] Successfully fetched HTML for /anime/${animeId}. Starting parsing...`);

                const { info, genreList } = this.parseDetails($, $(".infozingle p"));
                data.title = info.judul;
                data.japanese = info.japanese;
                data.score = info.skor;
                data.producers = info.produser;
                data.type = info.tIOPE; // Perhatikan 'tIOPE', mungkin typo dan seharusnya 'tipe'?
                data.status = info.status;
                data.episodes = this.num(info.totalEpisode);
                data.duration = info.durasi;
                data.aired = info.tanggalRilis;
                data.studios = info.studio;
                data.poster = this.str($("#venkonten .fotoanime img").attr("src"));
                
                console.log(`[OtakudesuParser] Parsing synopsis for /anime/${animeId}...`);
                data.synopsis = await this.parseSynopsis($, $(".sinopc p"), true);
                
                data.genreList = genreList;
                const listHeaderElements = $(".episodelist").toArray();
                listHeaderElements.forEach((listHeaderElement, index) => {
                    const listElements = $(listHeaderElement).find("ul li").toArray();
                    listElements.forEach((listElement) => {
                        const title = $(listElement).find("a").text();
                        const oriUrl = $(listElement).find("a").attr("href");
                        const otakudesuUrl = this.generateSourceUrl(oriUrl);
                        const slug = this.generateSlug(oriUrl);
                        const listType = index === 0 ? "batch" : index === 1 ? "episode" : "error";
                        if (listType !== "error") {
                            if (listType === "batch") {
                                data.batch = {
                                    title,
                                    batchId: slug,
                                    href: this.generateHref("batch", slug),
                                    otakudesuUrl,
                                };
                            }
                            else {
                                data.episodeList.push({
                                    title: this.num(title
                                        .toLowerCase()
                                        .split("episode")[1]
                                        ?.trim() // Optional chaining untuk trim
                                        .split(" ")
                                        .filter((str, index) => {
                                        if (!isNaN(Number(str)) && index === 0)
                                            return str;
                                    })
                                        .join("") || null), // Beri nilai null jika tidak ada angka
                                    episodeId: slug,
                                    href: this.generateHref("episode", slug),
                                    otakudesuUrl,
                                });
                            }
                        }
                    });
                });
                const animeElements = $(".isi-recommend-anime-series .isi-konten").toArray();
                animeElements.forEach((animeElement) => {
                    const card = this.parseAnimeCard5($(animeElement));
                    data.recommendedAnimeList.push(card);
                });

                const isEmpty = !data.title && data.episodeList.length === 0;
                console.log(`[OtakudesuParser] Checking empty data for /anime/${animeId}. Is empty: ${isEmpty}`);
                this.checkEmptyData(isEmpty); // Jika ini melempar error, itu bisa jadi penyebab 403
                
                console.log(`[OtakudesuParser] Successfully parsed details for animeId: ${animeId}`);
                return data;

            } catch (parseError) {
                console.error(`[OtakudesuParser] Error during parsing details for animeId: ${animeId}`, parseError);
                // Penting: Lempar ulang error agar bisa ditangani oleh controller
                // atau konversi menjadi error yang lebih spesifik jika perlu
                throw parseError; 
            }
        }).catch(scrapeError => {
            // Logging jika this.scrape sendiri yang melempar error (misalnya, error HTTP dari sumber)
            console.error(`[OtakudesuParser] Error from this.scrape for /anime/${animeId}:`, scrapeError);
            // Anda mungkin ingin melempar error ini atau error yang sudah di-wrap
            // agar controller bisa menanganinya dan mungkin menghasilkan 403.
            // Misalnya, jika scrapeError.status adalah 403 dari sumber:
            if (scrapeError && scrapeError.status === 403) {
                throw new Error(`Source Otakudesu returned 403 for /anime/${animeId}. Access forbidden by source.`);
            }
            throw scrapeError; // Lempar ulang errornya
        });
    }

    parseAnimeEpisode(episodeId) {
        console.log(`[OtakudesuParser] Attempting to parse episode for episodeId: ${episodeId}`);
        return this.scrape({
            path: `/episode/${episodeId}`,
            initialData: {
                // ... (initial data seperti sebelumnya)
                title: "",
                animeId: "",
                releaseTime: "",
                defaultStreamingUrl: "",
                hasPrevEpisode: false,
                prevEpisode: null,
                hasNextEpisode: false,
                nextEpisode: null,
                server: { qualities: [] },
                downloadUrl: { qualities: [] },
                info: {
                    credit: "",
                    encoder: "",
                    duration: "",
                    type: "",
                    genreList: [],
                    episodeList: [],
                },
            },
        }, async ($, data) => {
            try {
                console.log(`[OtakudesuParser] Successfully fetched HTML for /episode/${episodeId}. Starting parsing...`);
                // ... (logika parsing episode seperti sebelumnya)
                // Tambahkan logging di dalam bagian parsing jika diperlukan

                const { info, genreList } = this.parseDetails($, $(".infozingle p"));
                data.title = $(".posttl").text();
                data.animeId = this.generateSlug($($(".prevnext .flir a")
                    .toArray()
                    .filter((item) => {
                    if ($(item).text() === "See All Episodes") {
                        return item;
                    }
                })[0]).attr("href"));
                data.releaseTime = $(".kategoz .fa.fa-clock-o").next().text();
                data.defaultStreamingUrl = this.str($(".responsive-embed-stream iframe").attr("src"));
                data.info.genreList = genreList;
                data.info.type = info.tipe; // Mungkin 'tipe' bukan 'tIOPE'
                delete info["tipe"]; // Sesuaikan jika 'tipe' adalah key yang benar

                const serverElements = $(".mirrorstream ul").toArray();
                const nonceCacheKey = "otakudesuNonce";

                // Logging sebelum fetch nonce
                console.log(`[OtakudesuParser] Checking/Fetching nonce. Cache key: ${nonceCacheKey}`);
                if (!lruCache_1.cache.get(nonceCacheKey)) {
                    console.log(`[OtakudesuParser] Nonce not in cache. Fetching new nonce...`);
                    try {
                        const nonceResponse = await (0, dataFetcher_1.wajikFetch)(`${this.baseUrl}/wp-admin/admin-ajax.php`, this.baseUrl, {
                            method: "POST",
                            responseType: "json",
                            data: new URLSearchParams({
                                action: this.derawr("ff675Di7Ck7Ehf895hE7hBBi6E7Bk68k"), //nonce_DONZS DDoS Protection
                            }),
                        });
                        console.log(`[OtakudesuParser] Nonce fetch response:`, nonceResponse);
                        if (nonceResponse?.data) {
                            lruCache_1.cache.set(nonceCacheKey, nonceResponse.data);
                            console.log(`[OtakudesuParser] Nonce set in cache:`, nonceResponse.data);
                        } else {
                            console.warn(`[OtakudesuParser] Failed to get new nonce data from response.`);
                        }
                    } catch (nonceError) {
                        console.error(`[OtakudesuParser] Error fetching nonce:`, nonceError);
                        // Pertimbangkan untuk melempar error di sini jika nonce penting
                    }
                } else {
                    console.log(`[OtakudesuParser] Nonce found in cache.`);
                }
                
                // ... (sisa logika parsing server, navigasi, download, dll.)
                // Anda bisa menambahkan logging serupa di bagian-bagian ini

                const isEmpty = !data.title &&
                    !data.defaultStreamingUrl &&
                    !data.prevEpisode &&
                    !data.nextEpisode &&
                    data.downloadUrl.qualities.length === 0;
                this.checkEmptyData(isEmpty);
                console.log(`[OtakudesuParser] Successfully parsed episode: ${episodeId}`);
                return data;

            } catch (parseError) {
                console.error(`[OtakudesuParser] Error during parsing episode for episodeId: ${episodeId}`, parseError);
                throw parseError;
            }
        }).catch(scrapeError => {
            console.error(`[OtakudesuParser] Error from this.scrape for /episode/${episodeId}:`, scrapeError);
            throw scrapeError;
        });
    }

    async parseServerUrl(serverId) {
        console.log(`[OtakudesuParser] Attempting to parse server URL for serverId: ${serverId}`);
        const data = { url: "" };
        const nonceCacheKey = "otakudesuNonce";
        const serverIdArr = this.derawr(serverId).split("-");

        const getUrlData = async (nonce) => {
            console.log(`[OtakudesuParser] Fetching server URL data with nonce: ${nonce}, serverId parts: ${serverIdArr}`);
            return await (0, dataFetcher_1.wajikFetch)(`${this.baseUrl}/wp-admin/admin-ajax.php`, this.baseUrl, {
                method: "POST",
                responseType: "json",
                data: new URLSearchParams({
                    id: serverIdArr[0],
                    i: serverIdArr[1],
                    q: serverIdArr[2],
                    action: this.derawr("7f8A5AhE8g558Ai8k9AAikD7gkECBgD9"), // getMirror
                    nonce: nonce,
                }),
            });
        };

        const getHtml = (base64) => Buffer.from(base64, "base64").toString();
        const getUrl = (html) => this.generateSrcFromIframeTag(html);

        try {
            const nonce = lruCache_1.cache.get(nonceCacheKey);
            if (!nonce) {
                console.warn(`[OtakudesuParser] Nonce not found in cache for parseServerUrl. Attempting to fetch new one.`);
                // Logic untuk fetch nonce jika tidak ada di cache, mirip parseAnimeEpisode
                try {
                    const nonceResponse = await (0, dataFetcher_1.wajikFetch)(`${this.baseUrl}/wp-admin/admin-ajax.php`, this.baseUrl, {
                        method: "POST",
                        responseType: "json",
                        data: new URLSearchParams({ action: this.derawr("ff675Di7Ck7Ehf895hE7hBBi6E7Bk68k") }), // nonce_DONZS
                    });
                    console.log(`[OtakudesuParser] Fetched new nonce for server URL:`, nonceResponse);
                    if (nonceResponse?.data) {
                        lruCache_1.cache.set(nonceCacheKey, nonceResponse.data);
                        const urlResponse = await getUrlData(nonceResponse.data);
                        console.log(`[OtakudesuParser] Server URL data response (after new nonce):`, urlResponse);
                        data.url = getUrl(getHtml(urlResponse.data));
                    } else {
                        throw new Error("Failed to fetch new nonce for server URL.");
                    }
                } catch (newNonceError) {
                    console.error(`[OtakudesuParser] Error fetching new nonce for server URL:`, newNonceError);
                    throw newNonceError; // Lempar error agar bisa ditangani
                }
            } else {
                console.log(`[OtakudesuParser] Using cached nonce for parseServerUrl: ${nonce}`);
                const urlResponse = await getUrlData(nonce);
                console.log(`[OtakudesuParser] Server URL data response (with cached nonce):`, urlResponse);
                data.url = getUrl(getHtml(urlResponse.data));
            }
        }
        catch (error) {
            console.error(`[OtakudesuParser] Error fetching server URL data (initial try or with cached nonce):`, error);
            // Logika retry jika error.status === 403 (nonce mungkin expired)
            if (error && error.status === 403) {
                console.warn(`[OtakudesuParser] Received 403 for server URL data, possibly expired nonce. Fetching new nonce...`);
                try {
                    const nonceResponse = await (0, dataFetcher_1.wajikFetch)(`${this.baseUrl}/wp-admin/admin-ajax.php`, this.baseUrl, {
                        method: "POST",
                        responseType: "json",
                        data: new URLSearchParams({
                            action: this.derawr("ff675Di7Ck7Ehf895hE7hBBi6E7Bk68k"), //nonce_DONZS DDoS Protection
                        }),
                    });
                    console.log(`[OtakudesuParser] Fetched new nonce (after 403):`, nonceResponse);
                    if (nonceResponse?.data) {
                        lruCache_1.cache.set(nonceCacheKey, nonceResponse.data);
                        const response = await getUrlData(nonceResponse.data);
                        console.log(`[OtakudesuParser] Server URL data response (after 403 and new nonce):`, response);
                        data.url = getUrl(getHtml(response.data));
                    } else {
                        console.error(`[OtakudesuParser] Failed to get data for new nonce after 403.`);
                        throw new Error("Failed to retrieve server URL after nonce refresh due to missing nonce data.");
                    }
                } catch (retryError) {
                    console.error(`[OtakudesuParser] Error during retry for server URL data:`, retryError);
                    throw retryError; // Lempar errornya agar controller bisa menangani
                }
            }
            else {
                throw error; // Lempar error lain yang bukan 403
            }
        }

        const isEmpty = !data.url || data.url === "No iframe found";
        this.checkEmptyData(isEmpty);
        console.log(`[OtakudesuParser] Parsed server URL for ${serverId}: ${data.url}`);
        return data;
    }
    
    // ... (metode parseAnimeBatch tetap sama, Anda bisa menambahkan logging serupa jika perlu)
    parseAnimeBatch(batchId) {
        console.log(`[OtakudesuParser] Attempting to parse batch for batchId: ${batchId}`);
        return this.scrape({
            path: `/batch/${batchId}`,
            initialData: {
                // ... (initial data seperti sebelumnya)
                title: "",
                animeId: "",
                poster: "",
                japanese: "",
                type: "",
                score: "",
                episodes: 0,
                duration: "",
                studios: "",
                producers: "",
                aired: "",
                credit: "",
                genreList: [],
                downloadUrl: { formats: [] },
            },
        }, async ($, data) => {
            try {
                console.log(`[OtakudesuParser] Successfully fetched HTML for /batch/${batchId}. Starting parsing...`);
                // ... (logika parsing batch seperti sebelumnya)
                // Tambahkan logging di dalam bagian parsing jika diperlukan

                const isEmpty = !data.title && data.genreList.length === 0 && data.downloadUrl.formats.length === 0;
                this.checkEmptyData(isEmpty);
                console.log(`[OtakudesuParser] Successfully parsed batch for batchId: ${batchId}`);
                return data;
            } catch (parseError) {
                console.error(`[OtakudesuParser] Error during parsing batch for batchId: ${batchId}`, parseError);
                throw parseError;
            }
        }).catch(scrapeError => {
            console.error(`[OtakudesuParser] Error from this.scrape for /batch/${batchId}:`, scrapeError);
            throw scrapeError;
        });
    }
}
exports.default = OtakudesuParser;