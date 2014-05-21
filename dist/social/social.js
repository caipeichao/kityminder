/* global Promise: true */
/**
 * 百度脑图社会化功能
 *
 * 1. 百度账号登陆
 * 2. 百度云存储
 * 3. 分享
 * 4. 草稿箱同步
 * 5. 配置文件同步
 * @author techird
 */


$.extend( $.fn, {
    disabled: function ( value ) {
        if ( value === undefined ) return !!this.attr( 'disabled' );
        if ( value ) {
            this.attr( 'disabled', 'disabled' );
        } else {
            this.removeAttr( 'disabled' );
        }
        return this;
    },
    loading: function ( text ) {
        if ( text ) {
            this.disabled( true );
            this.attr( 'origin-text', this.text() );
            this.text( text );
        } else {
            this.text( this.attr( 'origin-text' ) );
            this.removeAttr( 'origin-text' );
            this.disabled( false );
        }
        return this;
    },
    text: ( function () {
        var originFn = $.fn.text;
        return function () {
            var textSpan = this.children( 'span.text' );
            if ( textSpan.length ) {
                return originFn.apply( textSpan, arguments );
            } else {
                return originFn.apply( this, arguments );
            }
        };
    } )()
} );

/**
 * 核心业务逻辑
 */
$( function () {

    // UI 元素
    var $panel, $login_btn, $save_btn, $share_btn, $user_btn, $user_menu,
        $draft_btn, $draft_menu, $share_dialog, $share_url, $copy_url_btn,

        // 当前文件的远端路径
        remotePath = null,

        // 当前登录的账户
        currentAccount,

        // 当前连接是否指示要加载一个分享的脑图
        isShareLink,

        isPathLink,

        uuid = function () {
            return ( ( +new Date() * 10000 ) + ( Math.random() * 9999 ) ).toString( 36 );
        },

        // 当前脑图的分享ID
        shareId = uuid(),

        titleSuffix = document.title || '百度脑图',

        // 脑图实例
        minder = window.km,

        // 草稿箱实例
        draftManager,

        // 当前是否要检测文档内容是否变化的开关
        watchingChanges = true,

        notice = ( function () {
            return window.alert;
        } )();

    start();

    function start() {
        initUI();
        initFrontia();
        if ( checkLogin() ) {
            return;
        }
        loadShare();
        bindShortCuts();
        bindDraft();
        draftManager && watchChanges();
        if ( draftManager && !loadPath() && !isShareLink ) loadDraft( 0 );
    }

    // 创建 UI
    function initUI() {
        $panel = $( '<div id="social"></div>' ).appendTo( 'body' );

        $login_btn = $( '<button>登录</button>' ).addClass( 'login' ).click( login ).appendTo( $panel );

        $user_btn = $( '<button><span class="text"></span></button>' ).addClass( 'user-file' );

        $user_menu = $.kmuidropmenu( {
            data: [ {
                label: '新建脑图',
                click: newFile
            }, {
                label: '到网盘管理文件...',
                click: function () {
                    window.open( 'http://pan.baidu.com/disk/home#dir/path=/apps/kityminder' );
                }
            }, {
                label: '注销',
                click: logout
            }, {
                divider: true
            } ]
        } ).addClass( 'user-file-menu' ).appendTo( 'body' ).kmui();

        $user_menu.attachTo( $user_btn );

        $save_btn = $( '<button id="save-btn">保存</button>' ).click( save )
            .addClass( 'baidu-cloud' );

        $share_btn = $( '<button id="share-btn">分享</button>' ).click( share )
            .addClass( 'share' ).appendTo( $panel );

        $draft_btn = $( '<button id="draft-btn">草稿箱</button>' ).appendTo( 'body' );

        $draft_menu = $.kmuidropmenu().addClass( 'draft-menu kmui-combobox-menu' ).appendTo( 'body' );
        $draft_menu.kmui().attachTo( $draft_btn );
        $draft_menu.on( 'aftershow', showDraftList );

        $share_dialog = $( '#share-dialog' );
        $share_url = $( '#share-url' );
        $copy_url_btn = $( '#copy-share-url' );

        $share_dialog.mousedown( function ( e ) {
            e.stopPropagation();
        } );

        var copyTrickTimer = 0;
        $( 'body' ).on( 'mousedown', function ( e ) {
            copyTrickTimer = setTimeout( function () {
                $share_dialog.hide();
                $share_btn.loading( false );
                $copy_url_btn.loading( false );
            }, 30 );
        } );

        if ( window.ZeroClipboard ) {
            var clip = new window.ZeroClipboard( $copy_url_btn, {
                hoverClass: 'hover',
                activeClass: 'active'
            } );
            clip.on( 'dataRequested', function ( client, args ) {
                $copy_url_btn.loading( '已复制' );
                clearTimeout( copyTrickTimer );
            } );
        }
    }

    // 初始化云平台 frontia
    function initFrontia() {
        var AK = 'wiE55BGOG8BkGnpPs6UNtPbb';
        baidu.frontia.init( AK );
        baidu.frontia.social.setLoginCallback( {
            success: setAccount,
            error: function ( error ) {
                notice( '登录失败！' );
            }
        } );
    }

    function initPreferneceSync() {
        if ( currentAccount ) {

        }
    }

    // 检查 URL 是否分享连接，是则加载分享内容
    function loadShare() {

        var pattern = /(?:shareId|share_id)=(\w+)([&#]|$)/;
        var match = pattern.exec( window.location ) || pattern.exec( document.referrer );
        if ( !match ) return;

        var shareId = match[ 1 ];

        $.ajax( {
            url: 'http://naotu.baidu.com/mongo.php',
            data: {
                action: 'find',
                id: shareId
            },
            dataType: 'json',
            success: function ( data ) {
                if ( data.error ) {
                    return notice( data.error );
                }
                if ( draftManager ) {
                    var draft = draftManager.openByPath( 'share/' + shareId );
                    if ( draft ) {
                        draftManager.load();
                    } else {
                        draftManager.create( 'share/' + shareId );
                        minder.importData( data.shareMinder.data, 'json' );
                    }
                } else {
                    minder.importData( data.shareMinder.data, 'json' );
                }
                setRemotePath( null, false );
                $share_btn.loading( false );
            },
            error: function () {
                notice( '请求分享文件失败，请重试！' );
            }
        } );

        $share_btn.loading( '正在加载分享内容...' );

        isShareLink = true;
    }

    // 检查 URL 是否请求加载用户文件，是则加载
    function loadPath() {
        var pattern = /path=(.+?)([&#]|$)/;
        // documemt.referrer 是为了支持被嵌在 iframe 里的情况
        var match = pattern.exec( window.location ) || pattern.exec( document.referrer );
        if ( !match ) return;
        if ( !currentAccount ) {
            setTimeout( function () {
                if ( !currentAccount ) return login();
                setRemotePath( decodeURIComponent( match[ 1 ], true ) );
                loadRemote();
            }, 1000 );
            return false;
        }
        setRemotePath( decodeURIComponent( match[ 1 ], true ) );
        loadRemote();
        return true;
    }

    function setRemotePath( path, saved ) {
        var filename;
        remotePath = path;
        if ( remotePath ) {
            filename = getFileName( remotePath );
            if ( !saved ) {
                filename = '* ' + filename;
            }
            $user_btn.text( filename );
        } else if ( currentAccount ) {
            $user_btn.text( '* ' + minder.getMinderTitle() );
        }

        document.title = [ filename || minder.getMinderTitle(), titleSuffix ].join( ' - ' );

        if ( saved ) {
            $save_btn.disabled( true ).text( '已保存' );
        } else {
            $save_btn.disabled( false ).text( '保存' );
        }
    }

    // 检查是否在 Cookie 中登录过了
    function checkLogin() {
        var account = baidu.frontia.getCurrentAccount();
        if ( account ) {
            login();
            return true;
        }
        return false;
    }

    // 用户点击登录按钮主动登录
    function login() {
        baidu.frontia.social.login( {
            response_type: 'token',
            media_type: 'baidu',
            redirect_uri: window.location.href,
            client_type: 'web'
        } );
    }

    function logout() {
        baidu.frontia.logOutCurrentAccount();
        setAccount( null );
    }

    // 设置用户后为其初始化
    function setAccount( account ) {
        currentAccount = account;
        if ( account ) {
            $user_btn.prependTo( $panel );
            $save_btn.appendTo( $panel );
            $share_btn.appendTo( $panel );
            $login_btn.detach();
            loadAvator();
            loadUserFiles();
            window.location.hash = '';
        } else {
            $user_btn.detach();
            $save_btn.detach();
            $login_btn.prependTo( $panel );
        }
    }

    // 加载用户头像
    function loadAvator() {
        var $img = $( '<img />' ).attr( {
            'src': 'social/loading.gif',
            'width': 16,
            'height': 16
        } ).prependTo( $user_btn );
        currentAccount.getDetailInfo( {
            success: function ( user ) {
                $img.attr( {
                    'src': user.extra.tinyurl
                } );
            }
        } );
    }

    // 加载用户最近使用的文件
    function loadUserFiles() {
        var sto = baidu.frontia.personalStorage;
        //$user_btn.loading( '加载最近脑图...' );

        sto.listFile( 'apps/kityminder/', {
            by: 'time',
            success: function ( result ) {
                if ( result.list.length ) {
                    //$user_btn.loading( false );
                    addToRecentMenu( result.list.filter( function ( file ) {
                        return getFileFormat( file.path ) in fileConf;
                    } ) );
                    syncPreference( result.list );
                }
            },
            error: function () {
                notice( '加载最近脑图失败！' );
                //$user_btn.loading( false );
            }
        } );
    }

    // 同步用户配置文件
    function syncPreference( fileList ) {

        // frontia 接口对象引用
        var sto = baidu.frontia.personalStorage;

        // 配置文件在网盘的路径
        var remotePreferencesPath = '/apps/kityminder/app.preferences';

        // 检查是否存在线上的配置文件
        var hasRemotePreferences = ~fileList.map( function ( file ) {
            return file.path;
        } ).indexOf( remotePreferencesPath );

        // 记录远端配置的和本地配置的版本
        // - 远端配置保存在 json 内容的 version 字段中
        // - 本地配置用 localStorage 来记录
        var remoteVersion = 0,
            localVersion = localStorage.preferencesVersion || 0;

        // 远端配置和本地配置的内容
        var remotePreferences, localPreferences;


        // 远端有配置，下载远端配置
        if ( hasRemotePreferences ) {
            downloadPreferences();
        }

        // 绑定实例上配置改变的事件，配置有变需要上传
        minder.on( 'preferenceschange', function () {
            localStorage.preferencesVersion = ++localVersion;
            uploadPreferences();
        } );

        // 下载远端配置
        function downloadPreferences() {

            // 比较远端和本地版本
            // - 远端版本较新则设置本地版本为远端版本
            // - 本地版本较新则上传本地版本
            function merge( remote ) {

                remoteVersion = remote.version;

                remotePreferences = remote.preferences;
                localPreferences = minder.getPreferences();

                if ( localVersion < remoteVersion ) {
                    minder.resetPreferences( remotePreferences );
                } else if ( localVersion > remoteVersion ) {
                    uploadPreferences();
                }

            }

            // 下载配置的过程
            // 需要先获得下载的 URL 再使用 ajax 请求内容
            sto.getFileUrl( remotePreferencesPath, {
                success: function ( url ) {
                    $.ajax( {
                        url: url,
                        cache: false,
                        dataType: 'json',
                        success: merge,
                        error: function () {
                            notice( '下载配置失败！' );
                        }
                    } );
                }
            } );
        }

        // 上传本地配置
        function uploadPreferences() {

            localPreferences = minder.getPreferences();

            // 上传的数据需要附带版本信息
            var data = {
                version: localVersion,
                preferences: localPreferences
            };

            var text = JSON.stringify( data );

            sto.uploadTextFile( text, remotePreferencesPath, {

                // 文件重复选择覆盖
                ondup: sto.constant.ONDUP_OVERWRITE,

                success: function ( savedFile ) {
                    console && console.log( '配置已上传' );
                },

                error: function ( e ) {
                    notice( '上传配置失败' );
                }
            } );
        }
    }

    // 加载当前 remoteUrl 中制定的文件
    function loadRemote() {
        var sto = baidu.frontia.personalStorage;

        $user_btn.loading( '加载“' + getFileName( remotePath ) + '”...' );

        sto.getFileUrl( remotePath, {
            success: function ( url ) {
                console.log(url);
                // the url to download the file on cloud dist
                var format = getFileFormat( remotePath );
                if ( format in fileConf ) {
                    loadFile(url, format);
                }
            },
            error: notice
        } );
    }
    var fileConf = {
        'km': {
            type : 'text',
            protocal : 'json'
        },
        'json': {
            type : 'text',
            protocal : 'json'
        },
        'xmind': {
            type : 'blob',
            protocal : 'xmind'
        },
        'mmap': {
            type : 'blob',
            protocal : 'mindmanager'
        },
        'mm': {
            type : 'text',
            protocal : 'freemind'
        }
    function getFileFormat( fileUrl ) {
        return fileUrl.split( '.' ).pop();
    }

    function loadFile( url, extension ){
        if ( extension in fileConf ) {

            var conf = fileConf[ extension ];

            var xhr = new XMLHttpRequest();
            xhr.open( "get", url, true );
            xhr.responseType = conf.type;
            xhr.onload = function () {
                if ( this.status == 200 && this.readyState ) {
                    var data = this.response;
                    importFile( data, conf.protocal );
                }
            };
            xhr.send();

        }
    }

    // 见文件数据导入minder
    function importFile( data, format ) {
        watchingChanges = false;

        minder.importData( data, format );

        if ( draftManager ) {
            if ( !draftManager.openByPath( remotePath ) ) {
                draftManager.create();
            }
            draftManager.save( remotePath );
            draftManager.sync();
        }

        minder.execCommand( 'camera', minder.getRoot() );
        $user_btn.loading( false ).text( getFileName( remotePath ) );

        watchingChanges = true;
    }

    // 添加文件到最近文件列表
    function addToRecentMenu( list ) {
        list.splice( 12 );
        list.forEach( function ( file ) {
            $user_menu.appendItem( {
                item: {
                    label: getFileName( file.path ),
                    value: file.path
                },
                click: openFile
            } );
        } );
    }

    // 从路径中抽取文件名
    function getFileName( path ) {
        return path.split( '/' ).pop();
    }

    // 点击文件菜单
    function openFile( e ) {
        var path = $( this ).data( 'value' );
        var draft = draftManager && draftManager.getCurrent();
        if ( draft && draft.path == path ) {
            if ( !draft.sync && window.confirm( '“' + getFileName( path ) + '”在草稿箱包含未保存的更改，确定加载网盘版本覆盖草稿箱中的版本吗？' ) ) {
                setRemotePath( path, true );
                loadRemote();
            }
        } else if ( draftManager ) {
            draft = draftManager.openByPath( path );
            setRemotePath( path, !draft || draft.sync );
            if ( draft ) {
                watchingChanges = false;
                draftManager.load();
                watchingChanges = true;
            } else {
                loadRemote();
            }
        } else {
            setRemotePath( path, true );
            loadRemote();
        }
    }

    // 新建文件
    function newFile() {
        setRemotePath( null, true );
        draftManager.create();
        minder.importData( '新建脑图', 'plain' );
        minder.execCommand( 'camera', minder.getRoot() );
    }

    function generateRemotePath() {
        var filename = window.prompt( "请输入文件名: ", minder.getMinderTitle() ) || minder.getMinderTitle();
        return '/apps/kityminder/' + filename + '.km';
    }

    function save() {
        if ( !currentAccount ) return;

        var data = minder.exportData( 'json' );
        var sto = baidu.frontia.personalStorage;

        function error( reason ) {
            notice( reason + '\n建议您将脑图以 .km 格式导出到本地！' );
            $save_btn.loading( false );
            clearTimeout( timeout );
        }

        var timeout = setTimeout( function () {
            error( '保存到云盘超时，可能是网络不稳定导致。' );
        }, 15000 );
        sto.uploadTextFile( data, remotePath || generateRemotePath(), {
            ondup: remotePath ? sto.constant.ONDUP_OVERWRITE : sto.constant.ONDUP_NEWCOPY,
            success: function ( savedFile ) {
                if ( savedFile.path ) {
                    if ( !remotePath ) {
                        addToRecentMenu( [ savedFile ] );
                    }
                    setRemotePath( savedFile.path, true );
                    if ( draftManager ) {
                        draftManager.save( remotePath );
                        draftManager.sync();
                    }
                    clearTimeout( timeout );
                } else {
                    error( '保存到云盘失败，可能是网络问题导致！' );
                }
            },
            error: function ( e ) {
                error( '保存到云盘失败' );
            }
        } );

        $save_btn.loading( '正在保存...' );
    }

    function share() {
        if ( $share_btn.disabled() ) {
            return;
        }

        var baseUrl = /^(.*?)(\?|\#|$)/.exec( window.location.href )[ 1 ];

        var shareUrl = baseUrl + '?shareId=' + shareId,

            shareData = new baidu.frontia.Data( {
                shareMinder: {
                    id: shareId,
                    data: minder.exportData( 'json' )
                }
            } );

        var shareConfig = window._bd_share_config.common,
            resetShare = window._bd_share_main.init;

        $share_btn.loading( '正在分享...' );

        $.ajax({
            url: 'http://naotu.baidu.com/mongo.php',
            type: 'POST',
            data: {
                action: 'insert',
                record: JSON.stringify( {
                    shareMinder: {
                        id: shareId,
                        data: minder.exportData( 'json' )
                    }
                } )
            },
            success: function ( result ) {
                if ( result.error ) {
                    notice( result.error );
                } else {
                    $share_dialog.show();
                    $share_url.val( shareUrl )[ 0 ].select();   
                }
            },
            error: function() {
                notice('分享失败，可能是当前的环境不支持该操作。');
            }
        } );

        shareConfig.bdTitle = shareConfig.bdText = minder.getMinderTitle();
        shareConfig.bdDesc = shareConfig.bdText = '“' + minder.getMinderTitle() + '” - 我用百度脑图制作的思维导图，快看看吧！（地址：' + shareUrl + '）';
        shareConfig.bdUrl = shareUrl;
        resetShare();
    }

    function bindShortCuts() {

        $( document.body ).keydown( function ( e ) {

            var keyCode = e.keyCode || e.which;
            //添加快捷键
            if ( ( e.ctrlKey || e.metaKey ) ) {
                switch ( keyCode ) {
                    //保存
                case KM.keymap.s:
                    if ( e.shiftKey ) {
                        share();
                    } else {
                        save();
                    }
                    e.preventDefault();
                    break;
                case KM.keymap.n:
                    newFile();
                    e.preventDefault();
                    break;
                }
            }
        } );
    }

    function watchChanges() {
        minder.on( 'contentchange', function () {
            if ( !watchingChanges ) return;
            var current = draftManager.save();
            if ( currentAccount ) {
                $save_btn.disabled( current.sync ).text( '保存' );
                setRemotePath( remotePath, current.sync );
            }
        } );
    }

    function showDraftList() {
        var list = draftManager.list(),
            draft, $draft, index;
        if ( !list.length ) {
            draftManager.create();
            list = draftManager.list();
        }

        draft = list.shift();
        $draft_menu.empty().append( '<li disabled="disabled" class="current-draft kmui-combobox-item kmui-combobox-item-disabled kmui-combobox-checked">' +
            '<span class="kmui-combobox-icon"></span>' +
            '<label class="kmui-combobox-item-label">' + draft.name +
            '<span class="update-time">' + getFriendlyTimeSpan( +new Date( draft.update ), +new Date() ) + '</span>' +
            '</label>' +
            '</li>' );

        $draft_menu.append( '<li class="kmui-divider"></li>' );

        index = 1;
        while ( list.length ) {
            draft = list.shift();
            $draft = $( '<li class="draft-item">' +
                '<a href="#">' + draft.name + '<span class="update-time">' + getFriendlyTimeSpan( +new Date( draft.update ), +new Date() ) + '</span></a><a class="delete" title="删除该草稿"></a></li>' );
            $draft.data( 'draft-index', index++ );
            $draft.appendTo( $draft_menu );
        }
        if ( index > 1 ) {
            $draft_menu.append( '<li class="kmui-divider"></li>' );
            $draft_menu.append( '<li class="draft-clear"><a href="#">清空草稿箱</a></li>' );
        }

        adjustDraftMenu();
    }

    function adjustDraftMenu() {
        var pos = $draft_btn.offset();
        pos.top -= $draft_menu.outerHeight() + 5;
        $draft_menu.offset( pos );
    }

    function bindDraft() {
        draftManager = window.draftManager;
        if ( !draftManager ) {
            if ( window.DraftManager ) {
                draftManager = window.draftManager = new window.DraftManager( minder );
            }
        }

        $draft_menu.delegate( 'a.delete', 'click', function ( e ) {
            var $li = $( this ).closest( 'li.draft-item' );
            draftManager.remove( +$li.data( 'draft-index' ) );
            $li.remove();
            showDraftList();
            e.stopPropagation();
        } )

        .delegate( 'li.draft-clear', 'click', function ( e ) {
            if ( window.confirm( '确认清除草稿箱吗？' ) ) {
                draftManager.clear();
                showDraftList();
            }
            e.stopPropagation();
        } )

        .delegate( 'li.draft-item', 'click', function ( e ) {
            loadDraft( +$( this ).data( 'draft-index' ) );
        } );
    }

    function loadDraft( index ) {
        var draft = draftManager.open( index ),
            isRemote;
        if ( !draft ) {
            minder.initStyle();
            return;
        }

        isRemote = draft.path.indexOf( '/apps/kityminder' ) === 0;
        if ( isRemote ) {
            setRemotePath( draft.path, draft.sync );
        }
        watchingChanges = false;
        draftManager.load();
        watchingChanges = true;
        if ( !isRemote ) {
            setRemotePath( null, false );
        }
    }

    function getFriendlyTimeSpan( t1_in_ms, t2_in_ms ) {
        var ms = Math.abs( t1_in_ms - t2_in_ms ),
            s = ms / 1000,
            m = s / 60,
            h = m / 60,
            d = h / 24;
        if ( s < 60 ) return "刚刚";
        if ( m < 60 ) return ( m | 0 ) + "分钟前";
        if ( h < 24 ) return ( h | 0 ) + "小时前";
        if ( d <= 30 ) return ( d | 0 ) + "天前";
        return "很久之前";
    }

    window.social = {
        setRemotePath: setRemotePath,
        watchChanges: function ( value ) {
            watchingChanges = value;
        }
    };
} );