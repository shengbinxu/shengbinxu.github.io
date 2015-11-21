/**
 * Created by xushengbin on 15/11/8.
 */
$(function(){
	//相册swiper
	var photoSwiper = new Swiper('#schools', {
		spaceBetween: 30,
		slidesPerView: 5,
		autoplay:1500,
		autoplayDisableOnInteraction: false,
		//speed:1000,
		loop: true,
		centeredSlides: true,
		lazyLoading: true
	});
	$('.swiper-button-next-custom,.swiper-button-prev-custom').mouseover(function(){
		$(this).addClass('hover');
	}).mouseleave(function(){
		$(this).removeClass('hover');
	});
	$('.swiper-button-next-custom').click(function(){
		photoSwiper.swipeNext();
	})
	$('.swiper-button-prev-custom').click(function(){
		photoSwiper.swipePrev();
	})

	//school log hover效果
	$('.photo').on('mouseenter',function(){
		console.log('mouseenter');
		var self = $(this);
		var id = self.data('id');
		self.text(id);
		self.addClass('hover');
	})
	$('.photo').on('mouseleave',function(){
		console.log('mouseleave');
		var self = $(this);
		self.removeClass('hover');
		self.text('');
	})
	//菜单
	$('.tabs li').on('click',function(){
		var target = $(this).data('target');
		console.log(target);
		$('.tabs li').removeClass('active');
		$(this).addClass('active');
		$('.info').hide();
		$('.info.'+target).show();
	})

})

//百度地图API功能
function loadJScript() {
	var script = document.createElement("script");
	script.type = "text/javascript";
	script.src = "http://api.map.baidu.com/api?v=2.0&ak=NGDSGtgmKhnWNAxsVfPkjtpc&callback=init";
	document.body.appendChild(script);
	var script = document.createElement("script");
	script.type = "text/javascript";
	script.src = "http://api.map.baidu.com/library/AreaRestriction/1.2/src/AreaRestriction_min.js";
	document.body.appendChild(script);
}
function init() {
	// 百度地图API功能
	var map = new BMap.Map("allmap");    // 创建Map实例
	var point = new BMap.Point(121.511846,31.305646);
	map.centerAndZoom(point, 11);  // 初始化地图,设置中心点坐标和地图级别

	//map.enableScrollWheelZoom();
	//var b = new BMap.Bounds(new BMap.Point(121.100162,31.384034),new BMap.Point(121.809475,31.156296));
	//try {
	//	BMapLib.AreaRestriction.setBounds(map, b);
	//} catch (e) {
	//	alert(e);
	//}

	var marker = new BMap.Marker(point);  // 创建标注
	map.addOverlay(marker);               // 将标注添加到地图中
	marker.setAnimation(BMAP_ANIMATION_BOUNCE); //跳动的动画
}
//window.onload = loadJScript;  //异步加载地图