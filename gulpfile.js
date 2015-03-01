var gulp = require('gulp');
var ngAnnotate = require('gulp-ng-annotate');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var templateCache = require('gulp-angular-templatecache');
var merge = require('gulp-merge');

gulp.task('default', function () {

    return merge(
        gulp.src('src/templates/*.html').pipe(templateCache('templates.js', {module:'uebb.hateoas', root: 'uebb_hateoas_templates'})),
        gulp.src(['src/js/hateoas.js', 'src/js/*.js']).pipe(ngAnnotate())
    )
        .pipe(concat('uebb-angular-hateoas.js'))
        .pipe(gulp.dest('dist'))
        .pipe(uglify())
        .pipe(concat('uebb-angular-hateoas.min.js'))
        .pipe(gulp.dest('dist'))

    ;
});

gulp.task('watch', function() {
    gulp.watch(['src/templates/*.html', 'src/js/hateoas.js', 'src/js/*.js'], ['default']);
});
