(function(wp){
    const { registerPlugin } = wp.plugins;
    const { PluginSidebar } = wp.editor;

    const { PanelBody, TextControl, Button, Notice } = wp.components;
    const { useSelect, useDispatch } = wp.data;
    const { Fragment, useState, useEffect, useCallback, useMemo } = wp.element;

    // Utility functions (stay unchanged)

    function extractKeywords(content) {
        const stopwords = ['the','is','at','which','on','and','a','to','of','in','it','with','as','for','its','by','an','but','be','are','this','that'];
        let words = content.replace(/(<([^>]+)>)/gi, "").replace(/[^\w\s]/g, "").toLowerCase().split(/\s+/);
        let freq = {};
        words.forEach(w => {
            if (!stopwords.includes(w) && w.length > 2) {
                freq[w] = (freq[w] || 0) + 1;
            }
        });
        return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,8).map(x=>x[0]);
    }

    function countHeadings(content) {
        return (content.match(/<h[2-6][^>]*>/g) || []).length;
    }

    function getInternalLinks(content, siteUrl) {
        const regex = /<a [^>]*href=["']([^"']+)["']/g;
        let count = 0, match;
        while ((match = regex.exec(content))) {
            if (match[1].startsWith(siteUrl)) count++;
        }
        return count;
    }

    function countImagesWithAlt(content) {
        const imgTags = content.match(/<img [^>]*>/g) || [];
        return imgTags.filter(tag => /alt=["'][^"']+["']/i.test(tag)).length;
    }


    // SEO Writing helpers (unchanged)

    function keywordDensity(text, keyword) {
        if (!keyword) return 0;
        const words = text.toLowerCase().split(/\s+/);
        const count = words.filter(w => w === keyword.toLowerCase()).length;
        return words.length ? (count / words.length) * 100 : 0;
    }

    function averageSentenceLength(text) {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        if (!sentences.length) return 0;
        const words = text.trim().split(/\s+/).length;
        return words / sentences.length;
    }

    function passiveVoicePercent(text) {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        if (!sentences.length) return 0;
        const passiveRegex = /\b(was|were|is|are|been|be|being)\b\s+\w+ed\b/;
        let passiveCount = sentences.reduce((acc, s) => acc + (passiveRegex.test(s.toLowerCase()) ? 1 : 0), 0);
        return (passiveCount / sentences.length) * 100;
    }

    function readabilitySuggestions(avgSentenceLen, passivePercent) {
        const suggestions = [];
        if (avgSentenceLen > 20) suggestions.push('Try shorter sentences');
        if (passivePercent > 15) suggestions.push('Reduce passive voice');
        return suggestions;
    }


    const Sidebar = () => {
        // Proper hook usage, no hooks before this line

        // Load editor state safely
        const postType = useSelect((select) => {
            const editor = select('core/editor');
            return editor ? editor.getCurrentPostType() : null;
        }, []);

        // Early exit if editor not ready
        if (!postType) {
            return wp.element.createElement('div', null, 'Loading SEO Sidebar...');
        }

        // Combined hook for editor state
        const { meta, post, postTitle, postContent, featuredImageUrl } = useSelect((select) => {
            const editor = select('core/editor');
            if (!editor) return {};
            return {
                meta: editor.getEditedPostAttribute('meta') || {},
                post: editor.getCurrentPost(),
                postTitle: editor.getEditedPostAttribute('title') || '',
                postContent: editor.getEditedPostContent() || '',
                featuredImageUrl: editor.getEditedPostAttribute('featured_image_url') || ''
            };
        }, []);

        const { editPost } = useDispatch('core/editor');

        const fallbackImageUrl = 'https://fajaede.nl/wp-content/uploads/fallback-og-image.png';
        const imageToShow = featuredImageUrl || fallbackImageUrl;

        // Use meta stored focus keyword as source of truth
        const currentKeyword = meta._fajaedeseo_focus_keyword || '';

        // React state variables
        const [aiLoading, setAiLoading] = useState(false);
        const [seoScore, setSeoScore] = useState(meta._fajaedeseo_seo_score || 0);
        const [feedback, setFeedback] = useState([]);

        // Memoize calculations for performance
        const siteUrl = window.location.origin;

        const keywordSuggestions = useMemo(() => extractKeywords(postContent), [postContent]);
        const headingCount = useMemo(() => countHeadings(postContent), [postContent]);
        const internalLinkCount = useMemo(() => getInternalLinks(postContent, siteUrl), [postContent, siteUrl]);
        const imagesWithAltCount = useMemo(() => countImagesWithAlt(postContent), [postContent]);

        const analysisData = useMemo(() => ({
            density: keywordDensity(postContent, currentKeyword),
            avgSentLen: averageSentenceLength(postContent),
            passivePercent: passiveVoicePercent(postContent)
        }), [postContent, currentKeyword]);

        const writingSuggestions = useMemo(() =>
            readabilitySuggestions(analysisData.avgSentLen, analysisData.passivePercent),
            [analysisData.avgSentLen, analysisData.passivePercent]
        );

        // Calculate SEO score and provide feedback
        const calculateScore = useCallback(() => {
            let score = 0, localFeedback = [];

            if (meta._fajaedeseo_meta_title) {
                const len = meta._fajaedeseo_meta_title.length;
                if (len >= 40 && len <= 60) {
                    score++;
                } else {
                    localFeedback.push('Title length (40–60 chars)');
                }

                if (currentKeyword && meta._fajaedeseo_meta_title.toLowerCase().includes(currentKeyword.toLowerCase())) {
                    score++;
                } else if (currentKeyword) {
                    localFeedback.push('Keyword in title');
                }
            } else {
                localFeedback.push('Add a meta title');
            }

            if (meta._fajaedeseo_meta_desc) {
                const len = meta._fajaedeseo_meta_desc.length;
                if (len > 80 && len <= 160) {
                    score++;
                } else {
                    localFeedback.push('Description length (80–160 chars)');
                }

                if (currentKeyword && meta._fajaedeseo_meta_desc.toLowerCase().includes(currentKeyword.toLowerCase())) {
                    score++;
                } else if (currentKeyword) {
                    localFeedback.push('Keyword in description');
                }
            } else {
                localFeedback.push('Add a meta description');
            }

            if (headingCount >= 2) score++; else localFeedback.push('Add more headings');
            if (imagesWithAltCount > 0) score++; else localFeedback.push('Add alt text to images');

            return { score, max: 6, localFeedback };
        }, [meta._fajaedeseo_meta_title, meta._fajaedeseo_meta_desc, currentKeyword, headingCount, imagesWithAltCount]);

        // Effect to update SEO score when dependencies change
        useEffect(() => {
            if (!post || !meta) return;

            const { score, localFeedback } = calculateScore();
            setSeoScore(score);
            setFeedback(localFeedback);

            if (parseInt(meta._fajaedeseo_seo_score) !== score) {
                editPost({ meta: { ...meta, _fajaedeseo_seo_score: score } });
            }
        }, [post, meta, calculateScore, editPost]);

        // Stable meta update function
        const setMeta = useCallback((key, value) => {
            if (value === undefined || value === null || !meta) return;
            editPost({ meta: { ...meta, [key]: value } });
        }, [meta, editPost]);

        // Direct keyword update
        const updateKeyword = useCallback((newKeyword) => {
            setMeta('_fajaedeseo_focus_keyword', newKeyword);
        }, [setMeta]);

        // AI Suggestion generators
        const aiSuggest = useCallback((field) => {
            setAiLoading(true);
            let suggestion;
            if (field === '_fajaedeseo_meta_title') {
                suggestion = `Top ${postTitle || 'your keyword'} | ${document.title.replace(' ‹', '').split('—')[0].trim()}`;
            } else {
                suggestion = `Discover ${postTitle || 'your topic'} on ${document.title.replace(' ‹', '').split('—')[0].trim()}. Uncover insights, tips, and value in every read!`;
            }

            setTimeout(() => {
                setMeta(field, suggestion);
                setAiLoading(false);
            }, 700);
        }, [postTitle, setMeta]);

        const scoreColor = useCallback((val) => val >= 5 ? 'green' : val >= 3 ? 'orange' : 'red', []);

        return (
            wp.element.createElement(Fragment, null,
                wp.element.createElement(PluginSidebar, { name: 'fajaedeseo-sidebar', title: 'fajaedeSeo' },
                    wp.element.createElement(PanelBody, { title: 'SEO Meta Fields', initialOpen: true },
                        wp.element.createElement(TextControl, {
                            label: 'Focus Keyword',
                            value: currentKeyword,
                            onChange: updateKeyword,
                            help: 'Target phrase for score and suggestions.'
                        }),
                        wp.element.createElement('div', { style: { marginBottom: '10px' } },
                            wp.element.createElement('strong', null, 'Keyword Suggestions: '),
                            keywordSuggestions.map(kw =>
                                wp.element.createElement('span', {
                                    key: kw,
                                    style: {
                                        background: kw === currentKeyword ? '#0073aa' : '#efefef',
                                        color: kw === currentKeyword ? '#fff' : '#000',
                                        borderRadius: '12px',
                                        margin: '2px',
                                        padding: '4px 9px',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'inline-block'
                                    },
                                    onClick: () => updateKeyword(kw)
                                }, kw)
                            )
                        ),
                        wp.element.createElement(TextControl, {
                            label: 'AI Meta Title',
                            value: meta._fajaedeseo_meta_title || '',
                            onChange: (val) => setMeta('_fajaedeseo_meta_title', val),
                            help: '40–60 chars, use keyword.'
                        }),
                        wp.element.createElement(Button, {
                            isSmall: true,
                            isSecondary: true,
                            disabled: aiLoading,
                            style: { marginBottom: '12px' },
                            onClick: () => aiSuggest('_fajaedeseo_meta_title')
                        }, aiLoading ? '…' : '🔮AI Title Suggest'),
                        wp.element.createElement(TextControl, {
                            label: 'AI Meta Description',
                            value: meta._fajaedeseo_meta_desc || '',
                            onChange: (val) => setMeta('_fajaedeseo_meta_desc', val),
                            help: '80–160 chars, summarize content.'
                        }),
                        wp.element.createElement(Button, {
                            isSmall: true,
                            isSecondary: true,
                            disabled: aiLoading,
                            onClick: () => aiSuggest('_fajaedeseo_meta_desc')
                        }, aiLoading ? '…' : '🔮AI Desc Suggest'),
                        wp.element.createElement('div', { style: { marginTop: '16px', textAlign: 'center' } },
                            wp.element.createElement('p', { style: { marginBottom: '6px', fontWeight: '600' } }, 'Social Preview Image'),
                            wp.element.createElement('img', {
                                src: imageToShow,
                                alt: 'Social Share Preview Image',
                                style: { maxWidth: '100%', height: 'auto', borderRadius: '8px', border: '1px solid #ddd' }
                            })
                        ),
                        wp.element.createElement('div', { style: { marginTop: '10px', marginBottom: '10px' } },
                            wp.element.createElement('strong', {
                                style: {
                                    padding: '6px 14px',
                                    borderRadius: '18px',
                                    background: scoreColor(seoScore),
                                    color: '#fff',
                                    display: 'inline-block',
                                    fontWeight: 'bold'
                                }
                            }, `SEO Score: ${seoScore} / 6`)
                        ),
                        feedback.length
                            ? wp.element.createElement(Notice, { status: 'warning', isDismissible: false }, 'Suggestions: ', feedback.join(', '))
                            : wp.element.createElement(Notice, { status: 'success', isDismissible: false }, 'Great job! Keep it up.')
                    ),
                    wp.element.createElement(PanelBody, { title: 'SEO Writing Analysis', initialOpen: false },
                        wp.element.createElement('div', null,
                            'Keyword Density: ',
                            wp.element.createElement('span', { style: { fontWeight: '600', color: analysisData.density >= 0.5 ? 'green' : 'red' } }, `${analysisData.density.toFixed(2)}%`)
                        ),
                        wp.element.createElement('div', null,
                            'Average Sentence Length: ',
                            wp.element.createElement('span', { style: { fontWeight: '600', color: analysisData.avgSentLen <= 20 ? 'green' : 'red' } }, analysisData.avgSentLen.toFixed(1))
                        ),
                        wp.element.createElement('div', null,
                            'Passive Voice Usage: ',
                            wp.element.createElement('span', { style: { fontWeight: '600', color: analysisData.passivePercent <= 15 ? 'green' : 'red' } }, `${analysisData.passivePercent.toFixed(1)}%`)
                        ),
                        writingSuggestions.length
                            ? wp.element.createElement(Notice, { status: 'warning', isDismissible: false }, 'Writing Tips: ', writingSuggestions.join(', '))
                            : wp.element.createElement(Notice, { status: 'success', isDismissible: false }, 'Good writing style detected.')
                    ),
                    wp.element.createElement(PanelBody, { title: 'Content Analysis', initialOpen: false },
                        wp.element.createElement('div', null,
                            'Headings found: ',
                            wp.element.createElement('span', { style: { color: headingCount >= 2 ? 'green' : 'red', fontWeight: '600' } }, headingCount)
                        ),
                        wp.element.createElement('div', null,
                            'Internal links: ',
                            wp.element.createElement('span', { style: { color: internalLinkCount > 0 ? 'green' : 'red', fontWeight: '600' } }, internalLinkCount)
                        ),
                        wp.element.createElement('div', null,
                            'Images with alt text: ',
                            wp.element.createElement('span', { style: { color: imagesWithAltCount > 0 ? 'green' : 'red', fontWeight: '600' } }, imagesWithAltCount)
                        )
                    )
                )
            )
        );
    };

    registerPlugin('fajaedeseo', {
        render: Sidebar,
        icon: 'admin-site-alt3'
    });
})(window.wp);
