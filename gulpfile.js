var gulp = require('gulp'),
    gulpPlugins = require('gulp-load-plugins')();

gulp.task('js', function () {

    return gulp.src(['src/js/hateoas.js', 'src/js/*.js'], {base: '.'}).pipe(gulpPlugins.ngAnnotate())
        .pipe(gulpPlugins.concat('uebb-angular-hateoas.js'))
        .pipe(gulp.dest('dist'))
        .pipe(gulpPlugins.uglify())
        .pipe(gulpPlugins.concat('uebb-angular-hateoas.min.js'))
        .pipe(gulp.dest('dist'))

    ;
});

gulp.task('templates', function () {

    return gulp.src('src/templates/*.html').pipe(gulpPlugins.angularTemplatecache('templates.js', {module:'uebb.hateoas.templates', standalone: true, root: 'uebb_hateoas_templates'}))
        .pipe(gulpPlugins.concat('uebb-angular-hateoas.templates.js'))
        .pipe(gulp.dest('dist'))
        .pipe(gulpPlugins.uglify())
        .pipe(gulpPlugins.concat('uebb-angular-hateoas.templates.min.js'))
        .pipe(gulp.dest('dist'))
        ;
});

gulp.task('default', ['js', 'templates']);

gulp.task('watch_js', function() {
    return gulp.watch(['src/js/*.js'], ['js']);

})

gulp.task('watch_templates', function() {
    return gulp.watch(['src/templates/*.html'], ['templates']);
});

gulp.task('watch', ['watch_js', 'watch_templates']);
