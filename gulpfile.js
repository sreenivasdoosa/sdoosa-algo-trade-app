var gulp = require("gulp");
var babel = require('gulp-babel');
var browserify = require("browserify");
var babelify = require("babelify");
var reactify = require("reactify");
var source = require("vinyl-source-stream");
var nodemon = require("gulp-nodemon");
var eslint = require('gulp-eslint');
var clean = require('gulp-clean');

gulp.task("lint", [], function () {
  return gulp.src(['src/**/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task("bundle-client", ["lint"], function () {
  return browserify({
    entries: "./src/client/main.js",
    debug: true
  }).transform(babelify, { presets: ["@babel/preset-env", "@babel/preset-react"] })
    .transform(reactify)
    .bundle()
    .pipe(source("main.js"))
    .pipe(gulp.dest("dist/client"));
});

gulp.task('clean', function () {
  return gulp.src('dist', { read: false })
    .pipe(clean());
});

gulp.task("deploy-client", ["bundle-client"], function () {
  return gulp.src(["src/client/index.html", "src/client/lib/bootstrap-css/css/bootstrap.min.css", "src/client/style.css", "src/client/assets/background.jpg"])
    .pipe(gulp.dest("dist/client"));
});

gulp.task('deploy-server-config', [], function () {
  return gulp.src(["src/config/config.json", "src/config/users.json", "src/config/strategies.json"])
    .pipe(gulp.dest("dist/config"));
});

gulp.task('deploy-server', ["lint", "deploy-server-config"], function () {
  return gulp.src('src/server/**/*.js')
    .pipe(babel({
      presets: ['@babel/env']
    }))
    .pipe(gulp.dest('dist/server'));
});

gulp.task('deploy', ["deploy-client", "deploy-server"], function () {
  console.log('Deployed client and server..');
});

gulp.task('watch', [], function () {
  return gulp.watch(['src/server/**/*.js'], function (event) {
    console.info('File changed: ', event.path);
    gulp.run('deploy-server');
  });
});

gulp.task("server", ["watch"], function () {

  var stream = nodemon({
    script: 'dist/server/index.js',
    ext: 'html js jsx css',
    ignore: ['src', 'dist/client']
  });

  stream.on('restart', function () {
    console.log('restarted!');
  }).on('crash', function () {
    console.error('Application has crashed!\n');
    stream.emit('restart', 10);  // restart the server in 10 seconds
  });
});
