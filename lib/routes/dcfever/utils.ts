import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import path from 'node:path';

const baseUrl = 'https://www.dcfever.com';

const parseItem = (item, tryGet) =>
    tryGet(item.link, async () => {
        const { data: response } = await got(item.link);
        const $ = load(response);
        const content = $('div[itemprop="articleBody"], .column_article_content_html');

        const pageLinks = $('.article_multi_page a')
            .not('.selected')
            .toArray()
            .map((i) => ({ link: new URL($(i).attr('href'), item.link).href }));

        if (pageLinks.length) {
            const pages = await Promise.all(
                pageLinks.map(async (pageLink) => {
                    const { data: response } = await got(pageLink.link);
                    const $ = load(response);
                    return $('div[itemprop="articleBody"]').html();
                })
            );
            content.append(pages);
        }

        content.find('img').each((_, e) => {
            if (e.attribs.src.includes('?')) {
                e.attribs.src = e.attribs.src.split('?')[0];
            }
        });

        content.find('p a').each((_, e) => {
            e = $(e);
            if (e.text().startsWith('下一頁為')) {
                e.remove();
            }
        });

        content.find('iframe').each((_, e) => {
            e = $(e);
            if (e.attr('src').startsWith('https://www.facebook.com/plugins/like.php')) {
                e.remove();
            }
        });

        item.description = content.html();
        item.pubDate = parseDate($('meta[property="article:published_time"]').attr('content'));

        return item;
    });

const parseTradeItem = (item, tryGet) =>
    tryGet(item.link, async () => {
        const { data: response } = await got(item.link);
        const $ = load(response);

        $('.selector_text').remove();
        $('.selector_image_div').each((_, div) => {
            delete div.attribs.onclick;
        });
        $('.desktop_photo_selector img').each((_, img) => {
            if (img.attribs.src.endsWith('_sqt.jpg')) {
                img.attribs.src = img.attribs.src.replace('_sqt.jpg', '.jpg');
            }
        });

        item.description = art(path.join(__dirname, 'templates/trading.art'), {
            info: $('.info_col'),
            description: $('.description_text').html(),
            photo: $('.desktop_photo_selector').html(),
        });

        return item;
    });

export { baseUrl, parseItem, parseTradeItem };
