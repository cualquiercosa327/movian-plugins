/**
 * Discovery Digital Network plugin for Movian Media Center
 *
 *  Copyright (C) 2015 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function(plugin) {
    var BASE_URL;
    var logo = plugin.path + "logo.png"

    var blue = "6699CC", orange = "FFA500";

    function colorStr(str, color) {
        return '<font color="' + color + '">(' + str + ')</font>';
    }

    function coloredStr(str, color) {
        return '<font color="' + color + '">' + str + '</font>';
    }

    function setPageHeader(page, title) {
        if (page.metadata) {
            page.metadata.title = decodeURIComponent(title);
            page.metadata.logo = logo;
        }
        page.type = "directory";
        page.contents = "items";
        page.loading = true;
    }

    function trim(s) {
        return s.replace(/(\r\n|\n|\r)/gm, "").replace(/(^\s*)|(\s*$)/gi, "").replace(/[ ]{2,}/gi, " ");
    }

    var service = plugin.createService(plugin.getDescriptor().title, plugin.getDescriptor().id + ":start", "video", true, logo);

    plugin.addURI(plugin.getDescriptor().id + ":play:(.*):(.*)", function(page, url, title) {
        page.loading = true;
        var doc = showtime.httpReq(BASE_URL + unescape(url)).toString();

        if (doc.match(/<iframe id="yt-iframe"/)) {
            //var link = 'youtube:video:' + escape('https:' + doc.match(/<iframe id="yt-iframe"[\s\S]*?src="([\s\S]*?)"/)[1]);
            page.type = "video";
            page.source = 'youtube:video:' + escape('https:' + doc.match(/<iframe id="yt-iframe"[\s\S]*?src="([\s\S]*?)"/)[1]);
        } else {
            var videoId = doc.match(/\'video_id\', (.*)\)/)[1];
            var json = showtime.JSONDecode(showtime.httpReq(BASE_URL + '/api/getPlaylist.json?api_key=ba9c741bce1b9d8e3defcc22193f3651b8867e62&codecs=h264&video_id=' + videoId));
            var link = 'hls:' + json.items[0].media.h264.hls.url
            page.type = "video";
            page.source = "videoparams:" + showtime.JSONEncode({
                title: decodeURIComponent(title),
                canonicalUrl: plugin.getDescriptor().id + ':play:' + url + ':' + title,
                sources: [{
                    url: link
                }]
            });
        }
        page.loading = false;
    });

    plugin.addURI(plugin.getDescriptor().id + ":site:(.*):(.*)", function(page, url, title) {
        setPageHeader(page, title);
        BASE_URL = unescape(url);

        var doc = showtime.httpReq(BASE_URL).toString();
        page.loading = false;
        // 1 - link, 2 - icon, 3 - title, 4 - description
        var featured = doc.match(/<div class="featured">[\s\S]*?<a href="([\s\S]*?)"[\s\S]*?background-image: url\(([\s\S]*?)\)[\s\S]*?title">([\s\S]*?)<\/p>[\s\S]*?subtitle">([\s\S]*?)<\/p>/);
        if (featured) {
            page.appendItem("", "separator", {
                title: 'Featured'
            });
            page.appendItem(plugin.getDescriptor().id + ':play:' + escape(featured[1]) + ':' + encodeURIComponent(featured[3]), "video", {
                title: featured[3],
                icon: featured[2],
                description: showtime.entityDecode(featured[4])
            });
        }

        page.appendItem("", "separator", {
            title: 'Menu'
        });
        // 1 - url, 2 - title
        var re = /<li class="item navItem">[\s\S]*?<a class="" href="([\s\S]*?)" data-track-attrs=\'\{"Tab": "([\s\S]*?)"\}\'>/g;
        var match = re.exec(doc);
        while (match) {
            page.appendItem(plugin.getDescriptor().id + ':index:' + escape(match[1]) + ':' + encodeURIComponent(match[2]), "directory", {
                title: match[2]
            });
            match = re.exec(doc);
        }

        page.appendItem("", "separator", {
            title: 'Recent'
        });
        var tryToSearch = true, offset = 0;

        // 1 - icon, 2 - title, 3 - url, 4 - description, 5 - show's name, 6 - show's url, 7 - time
        var re = /class="episode[\s\S]*?src="([\s\S]*?)"[\s\S]*?<a rel="([\s\S]*?)" href="([\s\S]*?)">[\s\S]*?<p class="description">([\s\S]*?)<\/p>[\s\S]*?rel="([\s\S]*?)" href="([\s\S]*?)"[\s\S]*?class="time">([\s\S]*?)<\/time>/g;

        function loader() {
            if (!tryToSearch) return false;
            page.loading = true;
            doc = showtime.httpReq(BASE_URL + '/episodes/page?offset=' + offset);
            page.loading = false;
            var match = re.exec(doc);
            if (!match)
                return tryToSearch = false
            while (match) {
                page.appendItem(plugin.getDescriptor().id + ':play:' + escape(match[3]) + ':' + encodeURIComponent(match[2]), "video", {
                    title: match[2],
                    icon: match[1],
                    description: new showtime.RichText(coloredStr('Show name: ', orange) + match[5] +
                        coloredStr('\nAdded: ', orange) + match[7] +
                        coloredStr('\nDescription: ', orange) + trim(match[4])
                    )
                });
                offset++;
                match = re.exec(doc);
            }
            return true;
        };

        loader();
        page.paginator = loader;
    });

    plugin.addURI(plugin.getDescriptor().id + ":start", function(page) {
        setPageHeader(page, plugin.getDescriptor().title);

        page.appendItem(plugin.getDescriptor().id + ':site:' + escape('https://revision3.com') + ':Revision3', "video", {
            title: 'Revision3: The Best TV Shows on the net.',
            icon: plugin.path + "revision3.png",
            description: 'We create and produce all-original weekly and daily episodic community driven programs watched by a super committed, passionate fan base. These shows are 100% HD, and run from under a minute to close to an hour. We develop, nurture and discover the shows and hosts that sit at the center of these new dynamic and rabid communities. Our hosts are experts not actors, with tremendous influence over their audiences.'
        });

        page.appendItem(plugin.getDescriptor().id + ':site:' + escape('https://animalist.com') + ':Animalist', "video", {
            title: 'Animalist: Ferociously Innocent.',
            icon: plugin.path + "animalist.jpg",
            description: "We all have a reaction to the animal world, whether it's love, fear, uncontrollable adoration, or total amazement. Animalist captures those moments by creating and sharing the most inspiring, fascinating, and passionate animal stories possible while positively impacting and advocating for animal welfare."
        });

        page.appendItem(plugin.getDescriptor().id + ':site:' + escape('https://testtube.com') + ':TestTube', "video", {
            title: 'TestTube: Believe in a more brilliant world.',
            icon: plugin.path + "testtube.png",
            description: "TestTube, a Discovery Digital network, is more than a point of view. It is a transformative lens through which we see wonder within the ordinary, magic in the mundane and inspiration everywhere."
        });

        page.loading = false;
    });

    function checkUrl(url) {
        return unescape(url).substr(0, 4) == 'http' ? unescape(url) : BASE_URL + unescape(url)
    }

    plugin.addURI(plugin.getDescriptor().id + ":index:(.*):(.*)", function(page, url, title) {
        setPageHeader(page, decodeURIComponent(title));
        var doc = showtime.httpReq(checkUrl(url)).toString();
        var shows = doc.match(/<div class="shows">([\s\S]*?)<\/ul>/);
        if (shows) {
            // 1 - url, 2 - title
            var re = /<div class="tab">[\s\S]*?href="([\s\S]*?)">([\s\S]*?)<\/a>/g;
            var match = re.exec(doc);
            while (match) {
                page.appendItem(plugin.getDescriptor().id + ':index:' + escape(match[1]) + ':' + encodeURIComponent(match[2]), "directory", {
                    title: match[2]
                });
                match = re.exec(doc);
            }

            // 1 - url, 2 - title, 3 - icon
            re = /<a href="([\s\S]*?)" title="([\s\S]*?)"[\s\S]*?src="([\s\S]*?)"/g;
            match = re.exec(shows[1]);
            while (match) {
                page.appendItem(plugin.getDescriptor().id + ':index:' + escape(match[1]) + ':' + encodeURIComponent(showtime.entityDecode(match[2])), "video", {
                    title: showtime.entityDecode(match[2]),
                    icon: match[3]
                });
                match = re.exec(shows[1]);
            }
        } else {
            var tryToSearch = true, offset = 0;

            // 1 - icon, 2 - title, 3 - url, 4 - description, 5 - show's name, 6 - show's url, 7 - time
            var re = /class="episode [\s\S]*?data-src="([\s\S]*?)"[\s\S]*?<a rel="([\s\S]*?)" href="([\s\S]*?)">[\s\S]*?<p class="description">([\s\S]*?)<\/p>[\s\S]*?rel="([\s\S]*?)" href="([\s\S]*?)"[\s\S]*?class="time">([\s\S]*?)<\/time>/g;

            function loader() {
                if (!tryToSearch) return false;
                var match = re.exec(doc);
                if (!match)
                     return tryToSearch = false
                while (match) {
                    page.appendItem(plugin.getDescriptor().id + ':play:' + escape(match[3]) + ':' + encodeURIComponent(match[2]), "video", {
                        title: match[2] ? unescape(match[2]) : trim(match[4]),
                        icon: match[1],
                        description: new showtime.RichText(coloredStr('Show name: ', orange) + match[5] +
                            coloredStr('\nAdded: ', orange) + match[7] +
                            (trim(match[4]) ? coloredStr('\nDescription: ', orange) + trim(match[4]) : '')
                        )
                    });
                    match = re.exec(doc);
                }
                var next = doc.match(/<div class="next active"><a href="([\s\S]*?)">/);
                if (next) {
                    page.loading = true;
                    doc = showtime.httpReq(BASE_URL + next[1]).toString();
                    page.loading = false;
                    return true;
                }
                return tryToSearch = false;
        };
            loader();
            page.paginator = loader;
        }
        page.loading = false;
    });

    plugin.addSearcher(plugin.getDescriptor().title, logo, function(page, query) {
        var doc = showtime.httpReq(BASE_URL + '/search/?q=' + escape(query)).toString();
        page.entries = 0;
        var tryToSearch = true;
        page.metadata.title += ' (' + trim(doc.match(/<div class="resultsCount">([\s\S]*?)<\/div>/)[1]) + ')';

        // 1 - icon, 2 - title, 3 - url, 4 - description
        var re = /class="search-result-item">[\s\S]*?src="([\s\S]*?)"[\s\S]*?<a rel="([\s\S]*?)" href="([\s\S]*?)">[\s\S]*?<p class="search-result-description">([\s\S]*?)<li/g;

        function loader() {
            if (!tryToSearch) return false;
            var match = re.exec(doc);
            while (match) {
                page.appendItem(plugin.getDescriptor().id + ':index:' + escape(match[3]) + ':' + encodeURIComponent(match[2]), "video", {
                    title: match[2],
                    icon: match[1],
                    description: new showtime.RichText(coloredStr('Description: ', orange) + trim(match[4]))
                });
                page.entries++;
                match = re.exec(doc);
            }
            var next = doc.match(/<a class="nextPage" href="([\S\s]*?)">/);
            if (next) {
                 page.loading = true;
                 doc = showtime.httpReq(BASE_URL + next[1]).toString();
                 page.loading = false;
                 return true;
            }
            return page.loading = tryToSearch = false;
        };

        loader();
        page.paginator = loader;
    });
})(this);