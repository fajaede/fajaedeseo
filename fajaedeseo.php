<?php
/*
Plugin Name: FajaedeSEO
Plugin URI: https://www.fajaede.nl/donate
Description: SEO plugin voor WordPress met dashboard, focus keywords, meta tags, analyse, XML Sitemap en robots.txt beheer.
Version: 1.7
Author: fEseo
Author URI: https://www.fajaede.nl
License: GPL2
Text Domain: fajaedeseo
*/

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

define('FAJAEDESEO_OG_IMAGE_FALLBACK', plugins_url('assets/fallback-og-image.jpg', __FILE__));

// Register post meta and settings including social handles
function fajaedeseo_register_meta_and_settings() {
    $post_types = ['post', 'page'];
    foreach ($post_types as $post_type) {
        register_post_meta($post_type, '_fajaedeseo_meta_title', [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            },
        ]);
        register_post_meta($post_type, '_fajaedeseo_meta_desc', [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'sanitize_callback' => 'sanitize_textarea_field',
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            },
        ]);
        register_post_meta($post_type, '_fajaedeseo_focus_keyword', [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            },
        ]);
        register_post_meta($post_type, '_fajaedeseo_seo_score', [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'integer',
            'sanitize_callback' => 'absint',
            'auth_callback' => function() {
                return current_user_can('edit_posts');
            },
        ]);
    }
    // Register options for robots.txt and social handles
    register_setting('fajaede_seo_settings_group', 'fajaede_robots_txt');
    register_setting('fajaede_seo_settings_group', 'fajaede_twitter_handle');
    register_setting('fajaede_seo_settings_group', 'fajaede_facebook_handle');
}
add_action('init', 'fajaedeseo_register_meta_and_settings');
add_action('admin_init', function() {
    register_setting('fajaede_seo_settings_group', 'fajaede_robots_txt');
    register_setting('fajaede_seo_settings_group', 'fajaede_twitter_handle');
    register_setting('fajaede_seo_settings_group', 'fajaede_facebook_handle');
});

// Enqueue assets for editor sidebar only admin
function fajaedeseo_enqueue_block_assets() {
    if (!is_admin()) {
        return;
    }
    $current_screen = get_current_screen();
    if ($current_screen && in_array($current_screen->base, ['post', 'post-new'])) {
        wp_enqueue_script(
            'fajaedeseo-sidebar',
            plugins_url('fajaedeseo-sidebar.js', __FILE__),
            ['wp-api-fetch', 'wp-element', 'wp-components', 'wp-data', 'wp-edit-post', 'wp-plugins'],
            filemtime(plugin_dir_path(__FILE__) . 'fajaedeseo-sidebar.js'),
            true
        );
        wp_enqueue_style(
            'fajaedeseo-style',
            plugins_url('fajaedeseo.css', __FILE__),
            [],
            filemtime(plugin_dir_path(__FILE__) . 'fajaedeseo.css')
        );
    }
}
add_action('admin_enqueue_scripts', 'fajaedeseo_enqueue_block_assets');


// Rewrite rule and query var for custom sitemap
add_filter('query_vars', function($vars) {
    $vars[] = 'fajaede_sitemap';
    return $vars;
});
add_action('init', function() {
    add_rewrite_rule('^fajaede_sitemap/?$', 'index.php?fajaede_sitemap=1', 'top');
});
// Sitemap output on template redirect
add_action('template_redirect', function() {
    if (intval(get_query_var('fajaede_sitemap')) !== 1) {
        return;
    }
    header('Content-Type: application/xml; charset=UTF-8');
    header('Cache-Control: no-cache, must-revalidate');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
    echo '<?xml-stylesheet type="text/xsl" href="' . plugins_url('sitemap-style.xsl', __FILE__) . '"?>' . PHP_EOL;
    echo '<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">' . PHP_EOL;

    $query = new WP_Query([
        'post_type' => ['post', 'page'],
        'post_status' => 'publish',
        'posts_per_page' => -1,
    ]);
    while ($query->have_posts()) {
        $query->the_post();
        echo "<url>\n";
        echo "\t<loc>" . esc_url(get_permalink()) . "</loc>\n";
        echo "\t<lastmod>" . get_the_modified_date('c') . "</lastmod>\n";
        echo "\t<changefreq>weekly</changefreq>\n";
        echo "\t<priority>0.6</priority>\n";
        echo "</url>\n";
    }
    wp_reset_postdata();
    echo '</urlset>';
    exit;
});

// Dynamic robots.txt output
add_action('do_robots', function() {
    $robots_content = get_option('fajaede_robots_txt');
    if ($robots_content) {
        header('Content-Type: text/plain; charset=UTF-8');
        echo $robots_content;
        exit;
    }
});

// Admin settings page
function fajaedeseo_render_settings_page() {
    $default_robots_txt = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: " . home_url('/fajaede_sitemap/');
    $robots_txt = get_option('fajaede_robots_txt', $default_robots_txt);
    $twitter_handle = get_option('fajaede_twitter_handle', '');
    $facebook_handle = get_option('fajaede_facebook_handle', '');

    ?>
    <div class="wrap">
        <h1>Fajaede SEO Instellingen</h1>
      
        <form method="post" action="options.php">
            <?php settings_fields('fajaede_seo_settings_group'); ?>
            <?php do_settings_sections('fajaede_seo_settings_group'); ?>

            <h2>Robots.txt Beheer</h2>
            <p>Hier kun je de inhoud van je robots.txt aanpassen. Dit wordt automatisch geserveerd op <code>/robots.txt</code> zolang er geen fysiek bestand is.</p>
            <textarea name="fajaede_robots_txt" rows="15" style="width:100%; font-family: monospace;"><?php echo esc_textarea($robots_txt); ?></textarea>

            <h2>Social Media Handles</h2>
            <p>Voer hier je Twitter en Facebook gebruikersnamen in (zonder @).</p>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="fajaede_twitter_handle">Twitter Handle</label></th>
                    <td><input type="text" id="fajaede_twitter_handle" name="fajaede_twitter_handle" value="<?php echo esc_attr($twitter_handle); ?>" class="regular-text"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="fajaede_facebook_handle">Facebook Handle</label></th>
                    <td><input type="text" id="fajaede_facebook_handle" name="fajaede_facebook_handle" value="<?php echo esc_attr($facebook_handle); ?>" class="regular-text"></td>
                </tr>
            </table>

            <?php submit_button('Opslaan'); ?>
             <p>Ga naar Instellingen > Permalinks en klik op ‘Wijzigingen opslaan’ zodat de nieuwe rewrite rules geactiveerd worden.</p>
        </form>
    </div>
    <?php
}
add_action('admin_menu', function() {
    add_options_page(
        'Fajaede SEO',
        'Fajaede SEO',
        'manage_options',
        'fajaede-seo',
        'fajaedeseo_render_settings_page'
    );
});



// SEO meta tags with Twitter and Facebook handles
function fajaedeseo_add_meta_tags() {
    if (!is_singular()) {
        return;
    }
    global $post;
    $meta_title = get_post_meta($post->ID, '_fajaedeseo_meta_title', true) ?: get_the_title($post);
    $meta_desc = get_post_meta($post->ID, '_fajaedeseo_meta_desc', true);
    if (empty($meta_desc)) {
        $meta_desc = wp_strip_all_tags(get_post_field('post_excerpt', $post) ?: get_post_field('post_content', $post));
        $meta_desc = mb_substr($meta_desc, 0, 160);
    }
    $url = get_permalink($post);
    $type = 'article';
    $site_name = get_bloginfo('name');
    $locale = get_locale();
    $modified_time = get_post_modified_time('c', false, $post);
    $author_name = get_the_author_meta('display_name', $post->post_author);
    $image_url = has_post_thumbnail($post) ? get_the_post_thumbnail_url($post, 'full') : FAJAEDESEO_OG_IMAGE_FALLBACK;
    $site_icon_url = get_site_icon_url() ?: $image_url;
    // Get social handles from options
    $twitter_handle = get_option('fajaede_twitter_handle');
    $facebook_handle = get_option('fajaede_facebook_handle');

        // This site uses the FajaedeSEO AI plugin 
    echo '<title>' . esc_html($meta_title) . '</title>' . "\n";
    echo '<meta name="title" content="' . esc_attr($meta_title) . '">' . "\n";
    echo '<meta name="description" content="' . esc_attr($meta_desc) . '">' . "\n";

    echo '<meta property="og:type" content="' . esc_attr($type) . '">' . "\n";
    echo '<meta property="og:title" content="' . esc_attr($meta_title) . '">' . "\n";
    echo '<meta property="og:description" content="' . esc_attr($meta_desc) . '">' . "\n";
    echo '<meta property="og:url" content="' . esc_url($url) . '">' . "\n";
    echo '<meta property="og:site_name" content="' . esc_attr($site_name) . '">' . "\n";
    echo '<meta property="og:image" content="' . esc_url($image_url) . '">' . "\n";
    echo '<meta property="og:locale" content="' . esc_attr($locale) . '">' . "\n";
    echo '<meta property="og:updated_time" content="' . esc_attr($modified_time) . '">' . "\n";

    echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
    echo '<meta name="twitter:title" content="' . esc_attr($meta_title) . '">' . "\n";
    echo '<meta name="twitter:description" content="' . esc_attr($meta_desc) . '">' . "\n";
    echo '<meta name="twitter:image" content="' . esc_url($image_url) . '">' . "\n";

    if (!empty($twitter_handle)) {
        echo '<meta name="twitter:site" content="@' . esc_attr($twitter_handle) . '">' . "\n";
        echo '<meta name="twitter:creator" content="@' . esc_attr($twitter_handle) . '">' . "\n";
    }
    if (!empty($facebook_handle)) {
        echo '<meta property="article:publisher" content="https://www.facebook.com/' . esc_attr($facebook_handle) . '"/>' . "\n";
    }

    // JSON-LD structured data
    $schema = [
        '@context' => 'https://schema.org',
        '@type' => 'Article',
        'mainEntityOfPage' => [
            '@type' => 'WebPage',
            '@id' => $url,
        ],
        'headline' => $meta_title,
        'description' => $meta_desc,
        'image' => [
            '@type' => 'ImageObject',
            'url' => $image_url,
            'width' => 1200,
            'height' => 630,
        ],
        'author' => [
            '@type' => 'Person',
            'name' => $author_name,
        ],
        'publisher' => [
            '@type' => 'Organization',
            'name' => $site_name,
            'logo' => [
                '@type' => 'ImageObject',
                'url' => $site_icon_url,
                'width' => 512,
                'height' => 512,
            ],
        ],
        'datePublished' => get_the_date(DATE_W3C, $post),
        'dateModified' => get_the_modified_date(DATE_W3C, $post),
        'url' => $url,
    ];
    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';
}
add_action('wp_head', 'fajaedeseo_add_meta_tags');
      // This site uses the FajaedeSEO AI plugin 